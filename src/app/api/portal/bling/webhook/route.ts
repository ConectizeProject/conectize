import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { parseBlingWebhook, getBlingResourceKeyFromWebhook } from '@/lib/integrations/bling/webhooks'
import crypto from 'crypto'

const PLATFORM_ID = 'bling'

function verifyBlingSignature (rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.BLING_WEBHOOK_SECRET ?? process.env.BLING_CLIENT_SECRET
  if (!secret || !signatureHeader) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')
  const match = signatureHeader.replace(/^sha256=/i, '').trim()
  return match.length > 0 && crypto.timingSafeEqual(Buffer.from(match, 'hex'), Buffer.from(expected, 'hex'))
}

export async function POST (request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const signatureHeader = request.headers.get('x-bling-signature-256') ?? request.headers.get('X-Bling-Signature-256')
  if (process.env.BLING_WEBHOOK_SECRET || process.env.BLING_CLIENT_SECRET) {
    if (!verifyBlingSignature(rawBody, signatureHeader)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
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

  const supabase = createSupabaseServiceClient()
  const { data: blingConn } = await supabase
    .from('hub_connections')
    .select('organization_id')
    .eq('platform_id', PLATFORM_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const organizationId = blingConn?.organization_id ? String(blingConn.organization_id) : null
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
      payload: payload,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !row) {
    console.error('[bling webhook] insert error', {
      platformId: PLATFORM_ID,
      eventType,
      externalId,
      message: error?.message ?? null,
      details: error?.details ?? null,
      code: error?.code ?? null,
    })
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  try {
    const { processBlingWebhook } = await import('@/lib/integrations/bling/webhook-service')
    await processBlingWebhook(String(row.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[bling webhook] process error', { id: row.id, message })
  }

  return NextResponse.json({ ok: true, id: row.id }, { status: 200 })
}
