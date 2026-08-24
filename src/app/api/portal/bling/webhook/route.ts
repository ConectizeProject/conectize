import { after, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, getBlingResourceKeyFromWebhook } from '@/lib/integrations/bling/webhooks'
import { normalizeBlingWebhookCompanyId, resolveBlingWebhookOrganizationId } from '@/lib/integrations/bling/resolve-bling-webhook-org'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const PLATFORM_ID = 'bling'

type BlingAuthRejectReason = 'missing_signature' | 'invalid_signature'
type BlingRoutingRejectReason = 'missing_company_id' | 'organization_unresolved'
type BlingRejectReason = BlingAuthRejectReason | BlingRoutingRejectReason

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

function getBlingClientSecret (): string | null {
  const secret = process.env.BLING_CLIENT_SECRET?.trim()
  return secret || null
}

function hmacHex (secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function hmacBase64 (secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

function timingEqual (a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

/**
 * Bling: header `X-Bling-Signature-256` = `sha256=` + HMAC-SHA256(body, client_secret) em hex.
 */
function verifyBlingSignature (
  rawBody: string,
  signatureHeader: string | null,
  clientSecret: string,
): boolean {
  if (!signatureHeader || !clientSecret) return false
  const received = signatureHeader.replace(/^sha256=/i, '').trim()
  if (!received) return false

  const hex = hmacHex(clientSecret, rawBody)
  const b64 = hmacBase64(clientSecret, rawBody)
  if (timingEqual(received.toLowerCase(), hex.toLowerCase())) return true
  if (timingEqual(received, b64)) return true
  if (timingEqual(signatureHeader.trim(), `sha256=${hex}`)) return true
  return false
}

function collectBlingIngressHeaders (request: Request): Record<string, string | null> {
  return {
    'x-bling-signature-256': request.headers.get('x-bling-signature-256')
      ?? request.headers.get('X-Bling-Signature-256'),
    'content-type': request.headers.get('content-type'),
    'user-agent': request.headers.get('user-agent'),
  }
}

function enrichPayloadWithIngressDebug (
  payload: unknown,
  debug: {
    reason: BlingRejectReason
    headers?: Record<string, string | null>
    body_bytes?: number
    company_id?: string | null
  },
): object {
  const base = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...(payload as Record<string, unknown>) }
    : { raw: payload }

  return {
    ...base,
    _webhook_ingress: debug,
  }
}

function rejectErrorMessage (reason: BlingRejectReason): string {
  switch (reason) {
    case 'missing_signature':
      return 'Webhook rejeitado: header X-Bling-Signature-256 ausente.'
    case 'invalid_signature':
      return 'Webhook rejeitado: assinatura X-Bling-Signature-256 inválida.'
    case 'missing_company_id':
      return 'Webhook rejeitado: companyId ausente no payload.'
    case 'organization_unresolved':
      return 'Webhook rejeitado: nenhuma conexão Bling corresponde ao companyId informado.'
    default:
      return 'Webhook rejeitado.'
  }
}

function rejectEventType (reason: BlingRejectReason): string {
  if (reason === 'missing_signature' || reason === 'invalid_signature') {
    return `auth.${reason}`
  }
  return `routing.${reason}`
}

function extractCompanyId (payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as Record<string, unknown>
  const raw = root.companyId ?? root.company_id ?? root.idEmpresa ?? root.empresaId
  return normalizeBlingWebhookCompanyId(raw)
}

async function resolveAuditOrganizationId (
  supabase: ServiceClient,
  companyId: string | null,
): Promise<string | null> {
  const strict = await resolveBlingWebhookOrganizationId(supabase, companyId)
  if (strict) return strict

  const { data: hostOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('is_host', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return hostOrg?.id ? String(hostOrg.id) : null
}

async function persistErrorWebhook (
  supabase: ServiceClient,
  input: {
    organizationId: string
    eventType: string
    externalId: string | null
    payload: object
    reason: BlingRejectReason
  },
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('integration_webhooks')
    .insert({
      organization_id: input.organizationId,
      platform_id: PLATFORM_ID,
      event_type: input.eventType,
      external_id: input.externalId,
      payload: input.payload,
      status: 'error',
      error_message: rejectErrorMessage(input.reason),
    })
    .select('id')
    .single()

  if (error || !row) {
    console.error('[bling webhook] error_webhook_insert_failed', {
      reason: input.reason,
      eventType: input.eventType,
      message: error?.message ?? null,
    })
    return null
  }

  return String(row.id)
}

async function recordRejectedWebhook (
  input: {
    payload: unknown
    externalId: string | null
    companyId: string | null
    reason: BlingRejectReason
    ingressHeaders?: Record<string, string | null>
    bodyBytes?: number
  },
): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient()
    const organizationId = await resolveAuditOrganizationId(supabase, input.companyId)
    if (!organizationId) return

    const auditPayload = enrichPayloadWithIngressDebug(input.payload, {
      reason: input.reason,
      headers: input.ingressHeaders,
      body_bytes: input.bodyBytes,
      company_id: input.companyId,
    })

    await persistErrorWebhook(supabase, {
      organizationId,
      eventType: rejectEventType(input.reason),
      externalId: input.externalId,
      payload: auditPayload,
      reason: input.reason,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[bling webhook] record_rejected_failed', { reason: input.reason, message })
  }
}

/** Health-check da URL cadastrada no Bling (alguns pings usam GET). */
export async function GET () {
  return NextResponse.json({ ok: true, endpoint: 'bling-webhook' }, { status: 200 })
}

function isBlingConnectivityPing (rawBody: string): boolean {
  const trimmed = String(rawBody || '').trim()
  return trimmed === '' || trimmed === '{}' || trimmed === '[]' || trimmed === 'ok' || trimmed === '""'
}

export async function POST (request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const contentType = request.headers.get('content-type')
  const userAgent = request.headers.get('user-agent')
  const clientSecret = getBlingClientSecret()
  const ingressHeaders = collectBlingIngressHeaders(request)
  const signatureHeader = ingressHeaders['x-bling-signature-256']

  if (isBlingConnectivityPing(rawBody)) {
    console.info('[bling webhook] connectivity_ping', {
      bodyBytes: rawBody.length,
      preview: JSON.stringify(rawBody).slice(0, 80),
      contentType,
      userAgent,
      hasSignature: Boolean(signatureHeader),
    })
    return NextResponse.json({ ok: true, ping: true }, { status: 200 })
  }

  let payload: unknown
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseBlingWebhook(payload)
  const eventType = parsed.kind === 'unknown' ? parsed.eventType : (parsed.eventType || 'unknown')
  const externalId = getBlingResourceKeyFromWebhook(parsed)
  const companyId = extractCompanyId(payload)

  if (clientSecret) {
    const rejectReason: BlingAuthRejectReason | null = !signatureHeader
      ? 'missing_signature'
      : !verifyBlingSignature(rawBody, signatureHeader, clientSecret)
        ? 'invalid_signature'
        : null

    if (rejectReason) {
      console.warn('[bling webhook] rejected_auth', {
        reason: rejectReason,
        bodyBytes: rawBody.length,
        contentType,
        userAgent,
        companyId,
        hasSignature: Boolean(signatureHeader),
      })

      await recordRejectedWebhook({
        payload,
        externalId,
        companyId,
        reason: rejectReason,
        ingressHeaders,
        bodyBytes: rawBody.length,
      })

      return NextResponse.json({ error: rejectReason }, { status: 401 })
    }
  } else {
    console.warn('[bling webhook] BLING_CLIENT_SECRET unset; signature not verified')
  }

  const routingReason: BlingRoutingRejectReason | null = !companyId
    ? 'missing_company_id'
    : null

  const supabase = createSupabaseServiceClient()
  const organizationId = routingReason
    ? null
    : await resolveBlingWebhookOrganizationId(supabase, companyId)

  const unresolvedRoutingReason: BlingRoutingRejectReason | null = !routingReason && !organizationId
    ? 'organization_unresolved'
    : routingReason

  if (unresolvedRoutingReason) {
    console.warn('[bling webhook] rejected_routing', {
      reason: unresolvedRoutingReason,
      companyId,
      eventType,
      externalId,
    })

    await recordRejectedWebhook({
      payload,
      externalId,
      companyId,
      reason: unresolvedRoutingReason,
      ingressHeaders,
      bodyBytes: rawBody.length,
    })

    return NextResponse.json({ error: unresolvedRoutingReason }, { status: 409 })
  }

  const { data: row, error } = await supabase
    .from('integration_webhooks')
    .insert({
      organization_id: organizationId,
      platform_id: PLATFORM_ID,
      event_type: eventType,
      external_id: externalId,
      payload,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !row) {
    console.error('[bling webhook] insert error', {
      platformId: PLATFORM_ID,
      eventType,
      externalId,
      companyId,
      message: error?.message ?? null,
      details: error?.details ?? null,
      code: error?.code ?? null,
    })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const webhookId = String(row.id)
  after(async () => {
    try {
      const { processBlingWebhook } = await import('@/lib/integrations/bling/webhook-service')
      await processBlingWebhook(webhookId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      console.error('[bling webhook] process error', { id: webhookId, message })
    }
  })

  return NextResponse.json({ ok: true, id: webhookId }, { status: 200 })
}
