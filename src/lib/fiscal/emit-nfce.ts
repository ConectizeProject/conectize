import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { decryptFiscalSecretToBuffer, decryptFiscalSecretToString } from '@/lib/fiscal/secrets'
import { buildNfceFromSalesOrder } from '@/lib/fiscal/build-nfce-from-sales-order'
import { createSefazClient, type SefazTransmitResult } from '@/lib/fiscal/sefaz-client'
import { nfceCscForEnvironment } from '@/lib/fiscal/csc'
import { getDefaultFiscalOperationNature } from '@/lib/fiscal/operation-nature'
import { isProductFiscalCorrectionError } from '@/lib/fiscal/product-fiscal-errors'
import { loadA1CertificateMaterial } from '@/lib/fiscal/certificate'
import {
  fiscalCertificateExpiredMessage,
  isFiscalCertificateExpired,
} from '@/lib/fiscal/certificate-validity'
import {
  isMissingColumnError,
  nfceNumberingPatch,
  nfeNumberingPatch,
  parseAllocatedFiscalNumber,
  type FiscalNumberingEnvironment,
  type FiscalNumberingProfileRow,
  type NfeNumberingProfileRow,
} from '@/lib/fiscal/numbering'
import { isSefazDenied, fiscalDocumentKind, isNfceCancelDeadlineExpired, NFCE_CANCEL_EXPIRED_ALERT } from '@/lib/fiscal/document-status'
import {
  asSignedNfceXml,
  buildNfeProcXml,
  extractQrCodeUrlFromXml,
  isDuplicateSefazError,
  isUncertainSefazError,
  type SefazConsultaParse,
} from '@/lib/fiscal/sefaz-consulta'

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
  submitted_xml?: string | null
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
  | {
    ok: false
    error: string
    message: string
    fiscalDocument?: FiscalDocumentRow | null
    needsCorrection?: boolean
  }

export type CancelNfceResult =
  | { ok: true, fiscalDocument: FiscalDocumentRow }
  | { ok: false, error: string, message: string }

function errorMessage (err: unknown, kind = 'NFC-e') {
  if (err && typeof err === 'object') {
    const record = err as { cStat?: unknown, xMotivo?: unknown, message?: unknown }
    const status = record.cStat ? `[${String(record.cStat)}] ` : ''
    const reason = String(record.xMotivo || record.message || '')
    if (/unsupported pkcs12|pkcs12 pfx/i.test(reason)) {
      return 'O certificado A1 usa um formato que o Node não abre como PFX. Recarregue o certificado em Configurações fiscais ou tente novamente.'
    }
    if (/body nao encontrado|resposta soap invalida/i.test(reason)) {
      return reason.includes('Trecho:')
        ? reason
        : 'A SEFAZ respondeu, mas o envelope SOAP não pôde ser lido. Tente enviar novamente.'
    }
    return `${status}${reason || `Falha ao transmitir ${kind}.`}`
  }
  return `Falha ao transmitir ${kind}.`
}

function errorStatusCode (err: unknown) {
  if (err && typeof err === 'object') {
    const record = err as { cStat?: unknown }
    if (record.cStat) return String(record.cStat)
  }
  return 'exception'
}

function certificateExpiredResult (validUntil: unknown): Extract<EmitNfceResult, { ok: false }> {
  return {
    ok: false,
    error: 'certificate_expired',
    message: fiscalCertificateExpiredMessage(validUntil),
  }
}

function readLiveCertificateExpiry (pfx: Buffer, password: string) {
  try {
    return loadA1CertificateMaterial(pfx, password).notAfter
  } catch {
    return null
  }
}

const FISCAL_DOCUMENT_SELECT = 'id, model, environment, series, number, access_key, status, protocol, qr_code_url, submitted_xml, sefaz_status_code, sefaz_status_message, authorized_at'

const TIMEOUT_MESSAGE = 'A SEFAZ não confirmou a autorização a tempo. A nota não foi reenviada para evitar duplicidade. Tente novamente para consultar o protocolo.'

function printedUrlFor (documentId: string) {
  return `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/danfe`
}

async function insertEvent (auth: AuthCtx, input: {
  documentId: string
  type: 'submit' | 'authorize' | 'reject' | 'cancel' | 'retry' | 'error'
  statusCode?: string | null
  statusMessage?: string | null
  payload?: Record<string, unknown> | null
}) {
  const service = createSupabaseServiceClient()
  const { error } = await service.from('fiscal_document_events').insert({
    organization_id: auth.organizationId,
    fiscal_document_id: input.documentId,
    event_type: input.type,
    status_code: input.statusCode ?? null,
    status_message: input.statusMessage ?? null,
    payload: input.payload ?? null,
  })
  if (error) {
    console.error('[fiscal] insertEvent', error)
  }
}

async function getExistingFiscalDocument (auth: AuthCtx, orderId: string, model: '55' | '65') {
  const { data } = await auth.supabase
    .from('fiscal_documents')
    .select(FISCAL_DOCUMENT_SELECT)
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)
    .eq('model', model)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as FiscalDocumentRow | null
}

async function allocateNfeNumberFromProfile (
  service: ReturnType<typeof createSupabaseServiceClient>,
  organizationId: string,
) {
  const { data, error } = await service
    .from('organization_fiscal_profiles')
    .select('nfe_series, nfe_next_number')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error || !data) {
    console.error('[nfe] allocate fallback load', error)
    return null
  }

  const { numbering, patch } = nfeNumberingPatch(data as NfeNumberingProfileRow)
  const { error: updateError } = await service
    .from('organization_fiscal_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  if (updateError) {
    console.error('[nfe] allocate fallback update', updateError)
    return null
  }

  return {
    series: numbering.series,
    number: numbering.nextNumber,
  }
}

async function allocateNumberFromProfile (
  service: ReturnType<typeof createSupabaseServiceClient>,
  organizationId: string,
  environment: FiscalNumberingEnvironment,
) {
  const envSelect = 'fiscal_environment, nfce_series, nfce_next_number, nfce_series_homologacao, nfce_next_number_homologacao, nfce_series_producao, nfce_next_number_producao'
  const first = await service
    .from('organization_fiscal_profiles')
    .select(envSelect)
    .eq('organization_id', organizationId)
    .maybeSingle()

  let profile = first.data as FiscalNumberingProfileRow | null
  let error = first.error

  if (error && isMissingColumnError(error)) {
    const legacy = await service
      .from('organization_fiscal_profiles')
      .select('fiscal_environment, nfce_series, nfce_next_number')
      .eq('organization_id', organizationId)
      .maybeSingle()
    profile = (legacy.data || null) as FiscalNumberingProfileRow | null
    error = legacy.error
  }

  if (error || !profile) {
    console.error('[nfce] allocate fallback load', error)
    return null
  }

  const { numbering, patch, legacyPatch } = nfceNumberingPatch(profile as FiscalNumberingProfileRow, environment)
  const { error: updateError } = await service
    .from('organization_fiscal_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  if (updateError && isMissingColumnError(updateError)) {
    const { error: legacyError } = await service
      .from('organization_fiscal_profiles')
      .update({ ...legacyPatch, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
    if (legacyError) {
      console.error('[nfce] allocate fallback update', legacyError)
      return null
    }
  } else if (updateError) {
    console.error('[nfce] allocate fallback update', updateError)
    return null
  }

  return {
    series: numbering.series,
    number: numbering.nextNumber,
  }
}

async function allocateNumber (
  auth: AuthCtx,
  environment: FiscalNumberingEnvironment,
  model: '55' | '65',
) {
  const service = createSupabaseServiceClient()
  const { data, error } = await service.rpc('allocate_fiscal_document_number', {
    p_organization_id: auth.organizationId,
    p_model: model,
    p_environment: environment,
  })

  const allocated = parseAllocatedFiscalNumber(data)
  if (allocated) return allocated
  if (error) {
    console.error('[fiscal] allocate_fiscal_document_number', error)
  }

  if (model === '55') {
    return allocateNfeNumberFromProfile(service, auth.organizationId)
  }
  return allocateNumberFromProfile(service, auth.organizationId, environment)
}

async function persistFiscalDocument (
  auth: AuthCtx,
  documentId: string,
  patch: Record<string, unknown>,
) {
  // Service role: evita falha silenciosa de RLS no meio da transmissão SEFAZ.
  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('fiscal_documents')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('organization_id', auth.organizationId)
    .select(FISCAL_DOCUMENT_SELECT)
    .maybeSingle()
  if (error) {
    console.error('[fiscal] persistFiscalDocument', error)
  }
  return (data || null) as FiscalDocumentRow | null
}

function authorizedResult (row: FiscalDocumentRow, alreadyAuthorized = false): Extract<EmitNfceResult, { ok: true }> {
  return {
    ok: true,
    fiscalDocument: row,
    alreadyAuthorized,
    printedUrl: printedUrlFor(row.id),
  }
}

async function applyConsultaOutcome (
  auth: AuthCtx,
  fiscalDocument: FiscalDocumentRow,
  consulta: SefazConsultaParse,
  signedXml: string | null,
): Promise<EmitNfceResult | 'missing'> {
  if (consulta.kind === 'not_found') return 'missing'

  if (consulta.kind === 'authorized') {
    const authorizedXml = signedXml && consulta.protNfeXml
      ? buildNfeProcXml(signedXml, consulta.protNfeXml)
      : null
    const qrCodeUrl = extractQrCodeUrlFromXml(signedXml || '')
    const updated = await persistFiscalDocument(auth, fiscalDocument.id, {
      status: 'authorized',
      access_key: fiscalDocument.access_key,
      protocol: consulta.protocol,
      sefaz_status_code: consulta.statusCode,
      sefaz_status_message: consulta.statusMessage,
      authorized_at: consulta.authorizedAt,
      ...(authorizedXml ? { authorized_xml: authorizedXml } : {}),
      ...(qrCodeUrl ? { qr_code_url: qrCodeUrl } : {}),
    })
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'authorize',
      statusCode: consulta.statusCode,
      statusMessage: consulta.statusMessage,
      payload: { recovered: true },
    })
    return authorizedResult((updated || {
      ...fiscalDocument,
      status: 'authorized',
      protocol: consulta.protocol,
      sefaz_status_code: consulta.statusCode,
      sefaz_status_message: consulta.statusMessage,
      authorized_at: consulta.authorizedAt,
    }) as FiscalDocumentRow)
  }

  const status = consulta.kind === 'denied'
    ? 'denied'
    : consulta.kind === 'canceled'
      ? 'canceled'
      : 'rejected'
  const updated = await persistFiscalDocument(auth, fiscalDocument.id, {
    status,
    sefaz_status_code: consulta.statusCode,
    sefaz_status_message: consulta.statusMessage,
    protocol: consulta.protocol,
    authorized_at: consulta.kind === 'denied' || consulta.kind === 'canceled' ? consulta.authorizedAt : null,
  })
  await insertEvent(auth, {
    documentId: fiscalDocument.id,
    type: consulta.kind === 'denied' ? 'reject' : consulta.kind === 'canceled' ? 'cancel' : 'reject',
    statusCode: consulta.statusCode,
    statusMessage: consulta.statusMessage,
    payload: { recovered: true },
  })
  return {
    ok: false,
    error: consulta.kind === 'denied' ? 'sefaz_denied' : 'sefaz_error',
    message: `[${consulta.statusCode}] ${consulta.statusMessage}`,
    fiscalDocument: (updated || fiscalDocument) as FiscalDocumentRow,
  }
}

async function recoverAfterUncertainSend (
  auth: AuthCtx,
  client: ReturnType<typeof createSefazClient>,
  fiscalDocument: FiscalDocumentRow,
  accessKey: string,
  signedXml: string | null,
): Promise<EmitNfceResult> {
  const timeoutPatch: Record<string, unknown> = {
    status: 'pending',
    access_key: accessKey,
    sefaz_status_code: 'timeout',
    sefaz_status_message: TIMEOUT_MESSAGE,
  }
  if (signedXml) timeoutPatch.submitted_xml = signedXml
  await persistFiscalDocument(auth, fiscalDocument.id, timeoutPatch)
  try {
    const consulta = await client.consultar(accessKey)
    const outcome = await applyConsultaOutcome(auth, { ...fiscalDocument, access_key: accessKey }, consulta, signedXml)
    if (outcome !== 'missing') return outcome
  } catch (err) {
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'error',
      statusCode: errorStatusCode(err),
      statusMessage: errorMessage(err),
      payload: { operation: 'consulta', after: 'timeout' },
    })
  }

  const pending = await persistFiscalDocument(auth, fiscalDocument.id, {
    status: 'pending',
    access_key: accessKey,
    sefaz_status_code: 'timeout',
    sefaz_status_message: TIMEOUT_MESSAGE,
  })
  await insertEvent(auth, {
    documentId: fiscalDocument.id,
    type: 'error',
    statusCode: 'timeout',
    statusMessage: TIMEOUT_MESSAGE,
    payload: { operation: 'consulta', accessKey },
  })
  return {
    ok: false,
    error: 'sefaz_timeout',
    message: TIMEOUT_MESSAGE,
    fiscalDocument: (pending || { ...fiscalDocument, access_key: accessKey, status: 'pending' }) as FiscalDocumentRow,
  }
}

async function applyTransmitResult (
  auth: AuthCtx,
  fiscalDocument: FiscalDocumentRow,
  result: SefazTransmitResult,
): Promise<EmitNfceResult> {
  const denied = isSefazDenied(result.statusCode)
  const status = result.authorized ? 'authorized' : denied ? 'denied' : 'rejected'
  const updated = await persistFiscalDocument(auth, fiscalDocument.id, {
    status,
    access_key: result.accessKey,
    authorized_xml: result.authorizedXml,
    protocol: result.protocol,
    qr_code_url: extractQrCodeUrlFromXml(result.authorizedXml || ''),
    sefaz_status_code: result.statusCode,
    sefaz_status_message: result.statusMessage,
    authorized_at: result.authorizedAt,
  })
  await insertEvent(auth, {
    documentId: fiscalDocument.id,
    type: result.authorized ? 'authorize' : 'reject',
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
  })
  const row = (updated || fiscalDocument) as FiscalDocumentRow
  if (result.authorized) return authorizedResult(row)

  const statusCode = String(result.statusCode || '').trim()
  const statusMessage = String(result.statusMessage || '').trim() || `A SEFAZ recusou a ${fiscalDocumentKind(fiscalDocument.model)}.`
  return {
    ok: false,
    error: denied ? 'sefaz_denied' : 'sefaz_error',
    message: statusCode ? `[${statusCode}] ${statusMessage}` : statusMessage,
    fiscalDocument: row,
  }
}

export async function getSalesOrderNfceState (auth: AuthCtx, orderId: string) {
  return getExistingFiscalDocument(auth, orderId, '65')
}

export async function getSalesOrderNfeState (auth: AuthCtx, orderId: string) {
  return getExistingFiscalDocument(auth, orderId, '55')
}

export async function emitNfceForSalesOrder (auth: AuthCtx, orderId: string) {
  return emitFiscalDocumentForSalesOrder(auth, orderId, '65')
}

export async function emitNfeForSalesOrder (auth: AuthCtx, orderId: string) {
  return emitFiscalDocumentForSalesOrder(auth, orderId, '55')
}

export async function emitFiscalDocumentForSalesOrder (
  auth: AuthCtx,
  orderId: string,
  model: '55' | '65',
): Promise<EmitNfceResult> {
  const kind = fiscalDocumentKind(model)
  const [{ data: profile }, operationNature, existing] = await Promise.all([
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
    getDefaultFiscalOperationNature(auth.organizationId, model),
    getExistingFiscalDocument(auth, orderId, model),
  ])

  if (!profile) {
    return { ok: false, error: 'missing_fiscal_profile', message: 'Complete o perfil fiscal da empresa antes de emitir.' }
  }

  if (existing?.status === 'authorized') {
    return authorizedResult(existing, true)
  }

  const service = createSupabaseServiceClient()
  const { data: certificate } = await service
    .from('organization_fiscal_certificates')
    .select('pfx_ciphertext, password_ciphertext, valid_until')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!certificate?.pfx_ciphertext || !certificate.password_ciphertext) {
    return { ok: false, error: 'missing_certificate', message: 'Cadastre o certificado digital A1 da empresa.' }
  }
  if (isFiscalCertificateExpired(certificate.valid_until)) {
    return certificateExpiredResult(certificate.valid_until)
  }

  const environment = profile.fiscal_environment === 'producao' ? 'producao' : 'homologacao'
  const cscPair = nfceCscForEnvironment(profile, environment)
  if (model === '65' && (!cscPair.id || !cscPair.ciphertext)) {
    return {
      ok: false,
      error: 'missing_csc',
      message: environment === 'producao'
        ? 'Informe o CSC e o ID Token de produção da NFC-e.'
        : 'Informe o CSC e o ID Token de homologação da NFC-e.',
    }
  }

  let pfx: Buffer
  let password: string
  let csc: string | undefined
  let client: ReturnType<typeof createSefazClient>
  const signedPersist = { documentId: '' }
  try {
    pfx = decryptFiscalSecretToBuffer(String(certificate.pfx_ciphertext))
    password = decryptFiscalSecretToString(String(certificate.password_ciphertext))
    const liveExpiry = readLiveCertificateExpiry(pfx, password)
    if (isFiscalCertificateExpired(liveExpiry)) {
      return certificateExpiredResult(liveExpiry)
    }
    csc = model === '65' && cscPair.ciphertext
      ? decryptFiscalSecretToString(cscPair.ciphertext)
      : undefined
    client = createSefazClient({
      pfx,
      password,
      environment,
      uf: String(profile.state || '').trim().toUpperCase(),
      documentModel: model,
      cscId: model === '65' ? String(cscPair.id || '').trim() || undefined : undefined,
      csc,
      async onSignedXml ({ xml, accessKey }) {
        if (!signedPersist.documentId) return
        await persistFiscalDocument(auth, signedPersist.documentId, {
          submitted_xml: xml,
          access_key: accessKey,
        })
      },
    })
  } catch (err) {
    console.error('[fiscal] certificate/csc setup failed', err)
    return {
      ok: false,
      error: 'certificate_setup_failed',
      message: errorMessage(err, kind),
    }
  }

  // Denegação (cStat 110/301/302) consome o número. Rejeição pode reutilizar.
  const reusable = existing?.status === 'denied' ? null : existing
  if (reusable?.access_key) {
    try {
      const consulta = await client.consultar(reusable.access_key)
      const recovered = await applyConsultaOutcome(
        auth,
        reusable,
        consulta,
        asSignedNfceXml(reusable.submitted_xml),
      )
      if (recovered !== 'missing') return recovered
    } catch (err) {
      await insertEvent(auth, {
        documentId: reusable.id,
        type: 'error',
        statusCode: errorStatusCode(err),
        statusMessage: errorMessage(err, kind),
        payload: { operation: 'consulta', before: 'retry' },
      })
      return {
        ok: false,
        error: 'sefaz_timeout',
        message: TIMEOUT_MESSAGE,
        fiscalDocument: reusable,
      }
    }
  }

  const numbering = reusable
    ? { series: Number(reusable.series), number: Number(reusable.number) }
    : await allocateNumber(auth, environment, model)
  if (!numbering) {
    return { ok: false, error: 'numbering_failed', message: `Não foi possível reservar a numeração da ${kind}.` }
  }

  let fiscalDocument = reusable
  if (!fiscalDocument) {
    // Service role após auth: staff/admin já validados; evita insert bloqueado por RLS.
    const { data: inserted, error: insertError } = await service
      .from('fiscal_documents')
      .insert({
        organization_id: auth.organizationId,
        model,
        environment,
        series: numbering.series,
        number: numbering.number,
        sales_order_id: orderId,
        status: 'pending',
      })
      .select(FISCAL_DOCUMENT_SELECT)
      .maybeSingle()

    if (insertError || !inserted) {
      console.error('[fiscal] insert fiscal_documents', insertError)
      const detail = insertError?.code ? ` (${insertError.code})` : ''
      return {
        ok: false,
        error: 'db_error',
        message: `Não foi possível criar o documento fiscal${detail}.`,
      }
    }
    fiscalDocument = inserted as FiscalDocumentRow
  } else {
    await insertEvent(auth, { documentId: fiscalDocument.id, type: 'retry' })
  }
  signedPersist.documentId = fiscalDocument.id

  const built = await buildNfceFromSalesOrder({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    orderId,
    profile,
    operationNature,
    series: numbering.series,
    number: numbering.number,
    model,
  })
  if (built.ok === false) {
    const needsCorrection = isProductFiscalCorrectionError(built.error)
    const updated = await persistFiscalDocument(auth, fiscalDocument.id, {
      status: needsCorrection ? 'pending' : 'rejected',
      sefaz_status_code: built.error,
      sefaz_status_message: built.message,
    })
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: needsCorrection ? 'error' : 'reject',
      statusCode: built.error,
      statusMessage: built.message,
    })
    return {
      ok: false,
      error: built.error,
      message: built.message,
      fiscalDocument: (updated || fiscalDocument) as FiscalDocumentRow,
      needsCorrection,
    }
  }

  await persistFiscalDocument(auth, fiscalDocument.id, {
    status: 'pending',
  })
  await insertEvent(auth, { documentId: fiscalDocument.id, type: 'submit' })

  try {
    const result = await client.transmitir(built.payload)
    return applyTransmitResult(auth, fiscalDocument, result)
  } catch (err) {
    const accessKey = client.lastAccessKey || fiscalDocument.access_key || null
    const signedXml = client.lastSignedXml
    if ((isUncertainSefazError(err) || isDuplicateSefazError(err)) && accessKey) {
      return recoverAfterUncertainSend(auth, client, fiscalDocument, accessKey, signedXml)
    }

    const message = errorMessage(err, kind)
    const statusCode = errorStatusCode(err)
    const denied = isSefazDenied(statusCode)
    const updated = await persistFiscalDocument(auth, fiscalDocument.id, {
      status: denied ? 'denied' : 'rejected',
      access_key: accessKey,
      sefaz_status_code: statusCode,
      sefaz_status_message: message,
      ...(signedXml ? { submitted_xml: signedXml } : {}),
    })
    await insertEvent(auth, {
      documentId: fiscalDocument.id,
      type: 'error',
      statusCode,
      statusMessage: message,
    })
    return {
      ok: false,
      error: denied ? 'sefaz_denied' : 'sefaz_error',
      message,
      fiscalDocument: (updated || fiscalDocument) as FiscalDocumentRow,
    }
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
    .maybeSingle()

  const fiscalDocument = doc as FiscalDocumentRow | null
  if (!fiscalDocument) {
    return { ok: false, error: 'not_found', message: 'Documento fiscal não encontrado.' }
  }
  if (fiscalDocument.status !== 'authorized' || !fiscalDocument.access_key || !fiscalDocument.protocol) {
    return { ok: false, error: 'not_authorized', message: `Somente ${fiscalDocumentKind(fiscalDocument.model)} autorizada pode ser cancelada.` }
  }
  if (String(fiscalDocument.model) !== '55' && isNfceCancelDeadlineExpired(fiscalDocument.authorized_at)) {
    return {
      ok: false,
      error: 'cancel_deadline_expired',
      message: NFCE_CANCEL_EXPIRED_ALERT.description,
    }
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
    .select('pfx_ciphertext, password_ciphertext, valid_until')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!certificate?.pfx_ciphertext || !certificate.password_ciphertext) {
    return { ok: false, error: 'missing_certificate', message: 'Certificado digital A1 não encontrado.' }
  }
  if (isFiscalCertificateExpired(certificate.valid_until)) {
    return {
      ok: false,
      error: 'certificate_expired',
      message: fiscalCertificateExpiredMessage(certificate.valid_until),
    }
  }

  try {
    const pfx = decryptFiscalSecretToBuffer(String(certificate.pfx_ciphertext))
    const password = decryptFiscalSecretToString(String(certificate.password_ciphertext))
    const liveExpiry = readLiveCertificateExpiry(pfx, password)
    if (isFiscalCertificateExpired(liveExpiry)) {
      return {
        ok: false,
        error: 'certificate_expired',
        message: fiscalCertificateExpiredMessage(liveExpiry),
      }
    }
    const cscPair = nfceCscForEnvironment(
      profile,
      fiscalDocument.environment === 'producao' ? 'producao' : 'homologacao',
    )
    const client = createSefazClient({
      pfx,
      password,
      environment: fiscalDocument.environment,
      uf: String(profile.state || '').trim().toUpperCase(),
      documentModel: String(fiscalDocument.model) === '55' ? '55' : '65',
      cscId: cscPair.id || undefined,
      csc: cscPair.ciphertext ? decryptFiscalSecretToString(cscPair.ciphertext) : undefined,
    })
    const result = await client.cancelar({
      accessKey: fiscalDocument.access_key,
      cnpj: String(profile.cnpj || '').replace(/\D/g, ''),
      protocol: fiscalDocument.protocol,
      justification: reason,
    })

    if (!result.confirmed) {
      await insertEvent(auth, {
        documentId: fiscalDocument.id,
        type: 'error',
        statusCode: result.statusCode || 'exception',
        statusMessage: result.statusMessage,
        payload: { operation: 'cancel' },
      })
      return {
        ok: false,
        error: 'sefaz_error',
        message: result.statusCode
          ? `[${result.statusCode}] ${result.statusMessage || 'A SEFAZ não homologou o cancelamento.'}`
          : (result.statusMessage || `A SEFAZ não homologou o cancelamento. A ${fiscalDocumentKind(fiscalDocument.model)} permanece autorizada.`),
      }
    }

    const { data: updated } = await auth.supabase
      .from('fiscal_documents')
      .update({
        status: 'canceled',
        sefaz_status_code: result.statusCode,
        sefaz_status_message: result.statusMessage || 'Cancelamento homologado pela SEFAZ',
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
      statusCode: result.statusCode,
      statusMessage: result.statusMessage,
      payload: { justification: reason, protocol: result.protocol },
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
