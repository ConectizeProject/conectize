import { after, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, getBlingResourceKeyFromWebhook } from '@/lib/integrations/bling/webhooks'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const PLATFORM_ID = 'bling'

function uniqueSecrets (): string[] {
  return [...new Set(
    [process.env.BLING_CLIENT_SECRET, process.env.BLING_WEBHOOK_SECRET]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )]
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
 * Aceita hex/base64, com ou sem prefixo, e tenta client secret + webhook secret.
 */
function verifyBlingSignature (rawBody: string, signatureHeader: string | null, secrets: string[]): boolean {
  if (!signatureHeader || secrets.length === 0) return false
  const received = signatureHeader.replace(/^sha256=/i, '').trim()
  if (!received) return false

  for (const secret of secrets) {
    const hex = hmacHex(secret, rawBody)
    const b64 = hmacBase64(secret, rawBody)
    if (timingEqual(received.toLowerCase(), hex.toLowerCase())) return true
    if (timingEqual(received, b64)) return true
    if (timingEqual(signatureHeader.trim(), `sha256=${hex}`)) return true
  }
  return false
}

function extractCompanyId (payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const root = payload as Record<string, unknown>
  const raw = root.companyId ?? root.company_id ?? root.idEmpresa ?? root.empresaId
  const text = String(raw ?? '').trim()
  return text || null
}

async function resolveOrganizationId (
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  companyId: string | null,
): Promise<string | null> {
  if (companyId) {
    const { data: byEmpresa } = await supabase
      .from('hub_connections')
      .select('organization_id, metadata')
      .eq('platform_id', PLATFORM_ID)
      .order('updated_at', { ascending: false })
      .limit(50)

    for (const row of byEmpresa || []) {
      const meta = row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null
      const empresaId = String(meta?.empresaId ?? meta?.companyId ?? '').trim()
      if (empresaId && empresaId === companyId && row.organization_id) {
        return String(row.organization_id)
      }
    }
  }

  const { data: blingConn } = await supabase
    .from('hub_connections')
    .select('organization_id')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return blingConn?.organization_id ? String(blingConn.organization_id) : null
}

/** Health-check da URL cadastrada no Bling (alguns pings usam GET). */
export async function GET () {
  return NextResponse.json({ ok: true, endpoint: 'bling-webhook' }, { status: 200 })
}

export async function POST (request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const secrets = uniqueSecrets()
  const signatureHeader = request.headers.get('x-bling-signature-256') ?? request.headers.get('X-Bling-Signature-256')

  if (secrets.length > 0 && signatureHeader) {
    if (!verifyBlingSignature(rawBody, signatureHeader, secrets)) {
      console.warn('[bling webhook] invalid_signature', {
        hasHeader: true,
        bodyBytes: rawBody.length,
      })
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  } else if (secrets.length > 0 && !signatureHeader) {
    // Bling v1 às vezes omite o header; rejeitar 401 faz o Bling parar de entregar.
    console.warn('[bling webhook] missing_signature_header_accepted', { bodyBytes: rawBody.length })
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
  const organizationId = await resolveOrganizationId(supabase, companyId)
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_context_missing' }, { status: 409 })
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
