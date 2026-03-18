import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

  const supabase = await createSupabaseServerClient()
  const { data: row, error } = await supabase
    .from('integration_webhooks')
    .insert({
      platform_id: PLATFORM_ID,
      event_type: eventType,
      external_id: externalId,
      payload: payload,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  try {
    const { processBlingWebhook } = await import('@/lib/integrations/bling/webhook-service')
    await processBlingWebhook(String(row.id))
  } catch {
  }

  return NextResponse.json({ ok: true, id: row.id }, { status: 200 })
}
