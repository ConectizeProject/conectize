import { after, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, getBlingResourceKeyFromWebhook } from '@/lib/integrations/bling/webhooks'
import {
  normalizeBlingWebhookCompanyId,
  resolveBlingWebhookConnection,
} from '@/lib/integrations/bling/resolve-bling-webhook-org'
import type { BlingWebhookMatchFailure } from '@/lib/integrations/bling/webhook-routing'

export const dynamic = 'force-dynamic'

const PLATFORM_ID = 'bling'

function collectBlingIngressHeaders (request: Request): Record<string, string | null> {
  return {
    'x-bling-signature-256': request.headers.get('x-bling-signature-256')
      ?? request.headers.get('X-Bling-Signature-256'),
    'content-type': request.headers.get('content-type'),
    'user-agent': request.headers.get('user-agent'),
  }
}

function extractCompanyId (payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as Record<string, unknown>
  const raw = root.companyId ?? root.company_id ?? root.idEmpresa ?? root.empresaId
  return normalizeBlingWebhookCompanyId(raw)
}

function webhookRejectStatus (reason: BlingWebhookMatchFailure): number {
  if (reason === 'missing_signature' || reason === 'invalid_signature') return 401
  return 409
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
  const supabase = createSupabaseServiceClient()
  const resolved = await resolveBlingWebhookConnection(supabase, {
    companyId,
    rawBody,
    signatureHeader,
  })

  if (resolved.ok === false) {
    console.warn('[bling webhook] rejected', {
      reason: resolved.reason,
      bodyBytes: rawBody.length,
      contentType,
      userAgent,
      companyId,
      hasSignature: Boolean(signatureHeader),
      eventType,
      externalId,
    })
    return NextResponse.json(
      { error: resolved.reason },
      { status: webhookRejectStatus(resolved.reason) },
    )
  }

  const organizationId = resolved.connection.organization_id

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
      organizationId,
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
