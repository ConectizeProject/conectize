import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'

/**
 * Envia uma mensagem de teste (admin) — número em E.164 sem + ou com +.
 */
export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { to?: string; text?: string } | null
  const to = String(body?.to || '').trim()
  const text = String(body?.text || 'Teste Conectize — integração WhatsApp OK.').trim()
  if (!to) {
    return NextResponse.json({ ok: false, error: 'to_required' }, { status: 400 })
  }

  const { data: row } = await auth.supabase
    .from('hub_connections')
    .select('access_token, metadata')
    .eq('platform_id', 'whatsapp_business')
    .maybeSingle()

  const token = row?.access_token as string | null
  const meta = (row?.metadata as { phone_number_id?: string }) || {}
  const phoneNumberId = String(meta.phone_number_id || '').trim()

  if (!token || !phoneNumberId) {
    return NextResponse.json({ ok: false, error: 'whatsapp_not_configured' }, { status: 400 })
  }

  const result = await sendWhatsAppTextMessage({
    phoneNumberId,
    accessToken: token,
    toE164Digits: to,
    body: text,
  })

  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: 'send_failed', detail: result.error },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, message_id: result.messageId ?? null })
}
