import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { verifyMetaWhatsAppSignature } from '@/lib/whatsapp/meta-signature'
import { processWhatsappWebhookPayload } from '@/lib/whatsapp/process-whatsapp-webhook'

export const dynamic = 'force-dynamic'

function pickPhoneNumberIdFromPayload (payload: unknown): string | null {
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string }
        }
      }>
    }>
  }
  for (const entry of p?.entry || []) {
    for (const change of entry?.changes || []) {
      const id = String(change?.value?.metadata?.phone_number_id || '').trim()
      if (id) return id
    }
  }
  return null
}

/**
 * GET: verificação do webhook (Meta envia hub.mode, hub.verify_token, hub.challenge).
 */
export async function GET (request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode !== 'subscribe' || !challenge) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const { data } = await supabase
    .from('hub_connections')
    .select('metadata')
    .eq('platform_id', 'whatsapp_business')
    .maybeSingle()
  const verify = String((data?.metadata as { verify_token?: string } | null)?.verify_token || '').trim()
  if (!verify || token !== verify) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/**
 * POST: eventos de mensagens (WhatsApp Cloud API).
 */
export async function POST (request: Request) {
  const appSecret =
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    null
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const sig = request.headers.get('x-hub-signature-256') ?? request.headers.get('X-Hub-Signature-256')
  if (appSecret) {
    if (!verifyMetaWhatsAppSignature(rawBody, sig, appSecret)) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
    }
  }

  let payload: unknown = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  let supabase
  try {
    supabase = createSupabaseServiceClient()
  } catch (e) {
    console.error('[whatsapp webhook] service client', e)
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  }

  try {
    const phoneNumberId = pickPhoneNumberIdFromPayload(payload)
    let organizationId: string | null = null
    if (phoneNumberId) {
      const { data: conns } = await supabase
        .from('hub_connections')
        .select('organization_id, metadata')
        .eq('platform_id', 'whatsapp_business')
      const matched = (conns || []).find((r) => {
        const meta = (r.metadata as { phone_number_id?: string } | null) || {}
        return String(meta.phone_number_id || '').trim() === phoneNumberId
      })
      organizationId = matched?.organization_id ? String(matched.organization_id) : null
    }
    if (!organizationId) {
      const { data: singleConn } = await supabase
        .from('hub_connections')
        .select('organization_id')
        .eq('platform_id', 'whatsapp_business')
        .limit(1)
        .maybeSingle()
      organizationId = singleConn?.organization_id ? String(singleConn.organization_id) : null
    }

    if (organizationId) {
      await supabase.from('integration_webhooks').insert({
        organization_id: organizationId,
        platform_id: 'whatsapp_cloud',
        event_type: 'incoming',
        external_id: null,
        payload: payload as object,
        status: 'pending',
      })
    }
  } catch (e) {
    console.error('[whatsapp webhook] log insert', e)
  }

  try {
    await processWhatsappWebhookPayload(supabase, payload)
  } catch (e) {
    console.error('[whatsapp webhook] process', e)
    return NextResponse.json({ ok: false, error: 'process_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
