import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { hintForWhatsappSendError } from '@/lib/whatsapp/evolution-send-errors'
import { isGroupWaKey, toEvolutionSendTarget } from '@/lib/whatsapp/wa-conversation-key'
import { resolveWhatsappOutboundForConversation } from '@/lib/whatsapp/whatsapp-outbound'

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
    .select('wa_from, organization_id')
    .eq('id', id)
    .maybeSingle()
  if (!conv?.wa_from || !conv.organization_id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const resolved = await resolveWhatsappOutboundForConversation(auth.supabase, id)

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        error: 'whatsapp_not_configured',
        hint: 'Configure WhatsApp Evolution ou Cloud API no Hub.',
      },
      { status: 400 },
    )
  }

  const waFrom = String(conv.wa_from)
  const sendTarget = toEvolutionSendTarget(waFrom)
  if (!sendTarget) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_recipient',
        hint: 'Este contato não tem número ou JID válido para envio. Tente sincronizar as conversas de novo.',
      },
      { status: 400 },
    )
  }
  if (!isGroupWaKey(waFrom) && sendTarget.replace(/\D/g, '').length < 10) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_recipient',
        hint: 'Número de telefone inválido nesta conversa.',
      },
      { status: 400 },
    )
  }

  const send = await resolved.send({
    toTarget: waFrom,
    body: text,
  })

  if (send.ok === false) {
    const err = String(send.error || 'send_failed')
    console.error('[whatsapp/send]', resolved.provider, waFrom, err)
    return NextResponse.json(
      {
        ok: false,
        error: err,
        hint: hintForWhatsappSendError(err, resolved.provider),
      },
      { status: send.status === 401 ? 401 : 502 },
    )
  }

  const waMessageId =
    resolved.provider === 'evolution' &&
    send.messageId &&
    'evolutionInstanceName' in resolved
      ? `${resolved.evolutionInstanceName}:${send.messageId}`
      : send.messageId ?? null

  await auth.supabase.from('whatsapp_messages').insert({
    conversation_id: id,
    direction: 'out',
    wa_message_id: waMessageId,
    body: text,
    payload: { source: 'staff', channel: resolved.provider },
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
