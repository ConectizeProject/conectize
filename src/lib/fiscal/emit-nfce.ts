import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { decryptFiscalSecretToBuffer, decryptFiscalSecretToString } from '@/lib/fiscal/secrets'
import { buildNfceFromSalesOrder } from '@/lib/fiscal/build-nfce-from-sales-order'
import { createSefazClient } from '@/lib/fiscal/sefaz-client'

type AuthCtx = PortalAuthStaffSuccess

type FiscalDocumentRow = {
  id: string
  model: string
  environment: 'homologacao' | 'producao'
  series: number
  number: number
  access_key?: string | null
  status: string
  protocol?: string | null
  qr_code_url?: string | null
  sefaz_status_code?: string | null
  sefaz_status_message?: string | null
  authorized_at?: string | null
}

export type EmitNfceResult =
  | {
    ok: true
    fiscalDocument: FiscalDocumentRow
    alreadyAuthorized: boolean
    printedUrl: string | null
  }
  | { ok: false, error: string, message: string }

export type CancelNfceResult =
  | { ok: true, fiscalDocument: FiscalDocumentRow }
  | { ok: false, error: string, message: string }

function errorMessage (err: unknown) {
  if (err && typeof err === 'object') {
    const record = err as { cStat?: unknown, xMotivo?: unknown, message?: unknown }
    const status = record.cStat ? `[${String(record.cStat)}] ` : ''
    const reason = record.xMotivo || record.message
    return `${status}${String(reason || 'Falha ao transmitir NFC-e.')}`
  }
  return 'Falha ao transmitir NFC-e.'
}

function errorStatusCode (err: unknown) {
  if (err && typeof err === 'object') {
    const record = err as { cStat?: unknown }
    if (record.cStat) return String(record.cStat)
  }
  return 'exception'
}

function extractQrCodeUrl (xml: string | null) {
  if (!xml) return null
  const cdata = xml.match(/<qrCode>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/qrCode>/)
  if (cdata?.[1]) return cdata[1].trim()
  const plain = xml.match(/<qrCode>([\s\S]*?)<\/qrCode>/)
  if (!plain?.[1]) return null
  return plain[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

async function insertEvent (auth: AuthCtx, input: {
  documentId: string
  type: 'submit' | 'authorize' | 'reject' | 'cancel' | 'retry' | 'error'
  statusCode?: string | null
  statusMessage?: string | null
  payload?: Record<string, unknown> | null
}) {
  await auth.supabase.from('fiscal_document_events').insert({
    organization_id: auth.organizationId,
    fiscal_document_id: input.documentId,
    event_type: input.type,
    status_code: input.statusCode ?? null,
    status_message: input.statusMessage ?? null,
    payload: input.payload ?? null,
  })
}

async function getExistingNfce (auth: AuthCtx, orderId: string) {
  const { data } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, access_key, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at')
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)
    .eq('model', '65')
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as FiscalDocumentRow | null
}

async function allocateNumber (auth: AuthCtx, environment: 'homologacao' | 'producao') {
  const { data, error } = await auth.supabase.rpc('allocate_fiscal_document_number', {
    p_organization_id: auth.organizationId,
    p_model: '65',
    p_environment: environment,
  })

  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    series: Number(row.series) || 1,
    number: Number(row.number) || 1,
  }
}

export async function getSalesOrderNfceState (auth: AuthCtx, orderId: string) {
  return getExistingNfce(auth, orderId)
}

export async function emitNfceForSalesOrder (auth: AuthCtx, orderId: string): Promise<EmitNfceResult> {
  const [{ data: profile }, existing] = await Promise.all([
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
    getExistingNfce(auth, orderId),
  ])

  if (!profile) {
    return { ok: false, error: 'missing_fiscal_profile', message: 'Complete o perfil fiscal da empresa antes de emitir.' }
  }

  if (existing?.status === 'authorized') {
    return {
      ok: true,
      fiscalDocument: existing,
      alreadyAuthorized: true,
      printedUrl: `/api/portal/fiscal/documents/${encodeURIComponent(existing.id)}/danfe`,
    }
  }

  const service = createSupabaseServiceClient()
  const { data: certificate } = await service
    .from('organization_fiscal_certificates')
    .select('pfx_ciphertext, password_ciphertext')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!certificate?.pfx_ciphertext || !certificate.password_ciphertext) {
    return { ok: false, error: 'missing_certificate', message: 'Cadastre o certificado digital A1 da empresa.' }
  }

  const cscCiphertext = profile.nfce_csc_ciphertext ? String(profile.nfce_csc_ciphertext) : ''
  if (!profile.nfce_csc_id || !cscCiphertext) {
    return { ok: false, error: 'missing_csc', message: 'Informe o CSC e o ID Token da NFC-e.' }
  }

  const pfx = decryptFiscalSecretToBuffer(String(certificate.pfx_ciphertext))
  const password = decryptFiscalSecretToString(String(certificate.password_ciphertext))
  const csc = decryptFiscalSecretToString(cscCiphertext)
  const environment = profile.fiscal_environment === 'producao' ? 'producao' : 'homologacao'

  const numbering = existing
    ? { series: Number(existing.series), number: Number(existing.number) }
    : await allocateNumber(auth, environment)
  if (!numbering) {
    return { ok: false, error: 'numbering_failed', message: 'Não foi possível reservar a numeração da NFC-e.' }
  }

  let fiscalDocument = existing
  if (!fiscalDocument) {
    const { data: inserted, error: insertError } = await auth.supabase
      .from('fiscal_documents')
      .insert({
        organization_id: auth.organizationId,
        model: '65',
        environment,
        series: numbering.series,
        number: numbering.number,
        sales_order_id: orderId,
        status: 'pending',
      })
      .select('id, model, environment, series, number, access_key, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at')
      .maybeSingle()

    if (insertError || !inserted) {
      return { ok: false, error: 'db_error', message: 'Não foi possível criar o documento fiscal.' }
    }
    fiscalDocument = inserted as FiscalDocumentRow
  } else {
    await insertEvent(auth, { documentId: fiscalDocument.id, type: 'retry' })
  }

  const built = await buildNfceFromSalesOrder({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    orderId,
    profile,
    series: numbering.series,
    number: numbering.number,
  })
  if (built.ok === false) {
    await auth.supabase
      .from('fiscal_documents')
      .update({
        status: 'rejected',
        sefaz_status_code: built.error,
        sefaz_status_message: built.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fiscalDocument.id)
      .eq('organization_id', auth.organizationId)
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'reject',
      statusCode: built.error,
      statusMessage: built.message,
    })
    return { ok: false, error: built.error, message: built.message }
  }

  await auth.supabase
    .from('fiscal_documents')
    .update({
      submitted_xml: built.submittedXmlPlaceholder,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', fiscalDocument.id)
    .eq('organization_id', auth.organizationId)
  await insertEvent(auth, { documentId: fiscalDocument.id, type: 'submit' })

  try {
    const client = createSefazClient({
      pfx,
      password,
      environment,
      uf: String(profile.state || '').trim().toUpperCase(),
      cscId: String(profile.nfce_csc_id || '').trim(),
      csc,
    })
    const result = await client.transmitir(built.payload)
    const status = result.authorized
      ? 'authorized'
      : result.statusCode === '110' || result.statusCode === '301' || result.statusCode === '302'
        ? 'denied'
        : 'rejected'
    const qrCodeUrl = extractQrCodeUrl(result.authorizedXml)
    const { data: updated } = await auth.supabase
      .from('fiscal_documents')
      .update({
        status,
        access_key: result.accessKey,
        authorized_xml: result.authorizedXml,
        protocol: result.protocol,
        qr_code_url: qrCodeUrl,
        sefaz_status_code: result.statusCode,
        sefaz_status_message: result.statusMessage,
        authorized_at: result.authorizedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fiscalDocument.id)
      .eq('organization_id', auth.organizationId)
      .select('id, model, environment, series, number, access_key, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at')
      .maybeSingle()

    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: result.authorized ? 'authorize' : 'reject',
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
    })

    const row = (updated || fiscalDocument) as FiscalDocumentRow
    return {
      ok: true,
      fiscalDocument: row,
      alreadyAuthorized: false,
      printedUrl: result.authorized ? `/api/portal/fiscal/documents/${encodeURIComponent(row.id)}/danfe` : null,
    }
  } catch (err) {
    const message = errorMessage(err)
    const statusCode = errorStatusCode(err)
    await auth.supabase
      .from('fiscal_documents')
      .update({
        status: 'rejected',
        sefaz_status_code: statusCode,
        sefaz_status_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fiscalDocument.id)
      .eq('organization_id', auth.organizationId)
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'error',
      statusCode,
      statusMessage: message,
    })
    return { ok: false, error: 'sefaz_error', message }
  }
}

export async function cancelNfceDocument (
  auth: AuthCtx,
  fiscalDocumentId: string,
  justification: string,
): Promise<CancelNfceResult> {
  const reason = String(justification || '').trim()
  if (reason.length < 15) {
    return { ok: false, error: 'invalid_justification', message: 'Informe uma justificativa com pelo menos 15 caracteres.' }
  }

  const { data: doc } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, access_key, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .eq('model', '65')
    .maybeSingle()

  const fiscalDocument = doc as FiscalDocumentRow | null
  if (!fiscalDocument) {
    return { ok: false, error: 'not_found', message: 'Documento fiscal não encontrado.' }
  }
  if (fiscalDocument.status !== 'authorized' || !fiscalDocument.access_key || !fiscalDocument.protocol) {
    return { ok: false, error: 'not_authorized', message: 'Somente NFC-e autorizada pode ser cancelada.' }
  }

  const [{ data: profile }, service] = await Promise.all([
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
    Promise.resolve(createSupabaseServiceClient()),
  ])

  if (!profile) {
    return { ok: false, error: 'missing_profile', message: 'Perfil fiscal não encontrado.' }
  }

  const { data: certificate } = await service
    .from('organization_fiscal_certificates')
    .select('pfx_ciphertext, password_ciphertext')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!certificate?.pfx_ciphertext || !certificate.password_ciphertext) {
    return { ok: false, error: 'missing_certificate', message: 'Certificado digital A1 não encontrado.' }
  }

  try {
    const client = createSefazClient({
      pfx: decryptFiscalSecretToBuffer(String(certificate.pfx_ciphertext)),
      password: decryptFiscalSecretToString(String(certificate.password_ciphertext)),
      environment: fiscalDocument.environment,
      uf: String(profile.state || '').trim().toUpperCase(),
      cscId: profile.nfce_csc_id ? String(profile.nfce_csc_id) : undefined,
      csc: profile.nfce_csc_ciphertext ? decryptFiscalSecretToString(String(profile.nfce_csc_ciphertext)) : undefined,
    })
    const result = await client.cancelar({
      accessKey: fiscalDocument.access_key,
      cnpj: String(profile.cnpj || '').replace(/\D/g, ''),
      protocol: fiscalDocument.protocol,
      justification: reason,
    })

    const eventResult = result as { codigoStatus?: string, motivo?: string }
    const { data: updated } = await auth.supabase
      .from('fiscal_documents')
      .update({
        status: 'canceled',
        sefaz_status_code: eventResult.codigoStatus ?? '135',
        sefaz_status_message: eventResult.motivo ?? 'Evento de cancelamento registrado',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', auth.organizationId)
      .eq('id', fiscalDocument.id)
      .select('id, model, environment, series, number, access_key, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at')
      .maybeSingle()

    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'cancel',
      statusCode: eventResult.codigoStatus ?? null,
      statusMessage: eventResult.motivo ?? null,
      payload: { justification: reason },
    })

    return { ok: true, fiscalDocument: (updated || fiscalDocument) as FiscalDocumentRow }
  } catch (err) {
    const message = errorMessage(err)
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'error',
      statusCode: errorStatusCode(err),
      statusMessage: message,
      payload: { operation: 'cancel' },
    })
    return { ok: false, error: 'sefaz_error', message }
  }
}
