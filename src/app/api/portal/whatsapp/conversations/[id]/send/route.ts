import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'

export async function POST (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null) as { text?: string } | null
  const text = String(body?.text || '').trim()
  if (!id || !text) {
    return NextResponse.json({ ok: false, error: 'text_required' }, { status: 400 })
  }

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('wa_from')
    .eq('id', id)
    .maybeSingle()
  if (!conv?.wa_from) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: hub } = await auth.supabase
    .from('hub_connections')
    .select('access_token, metadata')
    .eq('platform_id', 'whatsapp_business')
    .maybeSingle()

  const token = hub?.access_token as string | null
  const meta = (hub?.metadata as { phone_number_id?: string }) || {}
  const phoneNumberId = String(meta.phone_number_id || '').trim()
  if (!token || !phoneNumberId) {
    return NextResponse.json({ ok: false, error: 'whatsapp_not_configured' }, { status: 400 })
  }

  const send = await sendWhatsAppTextMessage({
    phoneNumberId,
    accessToken: token,
    toE164Digits: String(conv.wa_from).replace(/\D/g, ''),
    body: text,
  })

  if (send.ok === false) {
    return NextResponse.json({ ok: false, error: send.error }, { status: 502 })
  }

  await auth.supabase.from('whatsapp_messages').insert({
    conversation_id: id,
    direction: 'out',
    wa_message_id: send.messageId ?? null,
    body: text,
    payload: { source: 'staff' },
    status: 'attended',
    resolved_by: 'human',
    needs_human: false,
  })

  await auth.supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString(), needs_staff_attention: false })
    .eq('id', id)

  return NextResponse.json({ ok: true, message_id: send.messageId ?? null })
}
