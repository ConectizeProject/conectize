import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  archiveEvolutionChat,
  parseEvolutionStableMessageId,
  toEvolutionRemoteJid,
} from '@/lib/whatsapp/evolution-archive-client'
import {
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
  type WhatsappEvolutionHubMetadata,
} from '@/lib/whatsapp/evolution-hub-config'
import { resolveWhatsappOutboundForConversation } from '@/lib/whatsapp/whatsapp-outbound'

/** Arquiva no WhatsApp (Evolution) e remove conversa do portal. */
export async function POST (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { data: conv, error: findErr } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id, wa_from, hub_connection_id')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!conv) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const outbound = await resolveWhatsappOutboundForConversation(auth.supabase, id)
  let archivedOnWhatsapp = false

  if (outbound?.provider === 'evolution') {
    const remoteJid = toEvolutionRemoteJid(String(conv.wa_from))
    if (remoteJid) {
      const { data: lastMsg } = await auth.supabase
        .from('whatsapp_messages')
        .select('wa_message_id, direction')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const waId = String(lastMsg?.wa_message_id || '').trim()
      const meta = outbound.automationMeta as WhatsappEvolutionHubMetadata
      const baseUrl = resolveEvolutionApiBaseUrl(meta)
      let apiKey = resolveEvolutionApiKey(null)

      if (conv.hub_connection_id) {
        const { data: hub } = await auth.supabase
          .from('hub_connections')
          .select('access_token')
          .eq('id', conv.hub_connection_id)
          .maybeSingle()
        apiKey = resolveEvolutionApiKey(hub?.access_token as string | null)
      }

      if (waId && baseUrl && apiKey) {
        const archived = await archiveEvolutionChat({
          baseUrl,
          apiKey,
          instanceName: outbound.evolutionInstanceName,
          remoteJid,
          lastMessageId: parseEvolutionStableMessageId(waId),
          lastMessageFromMe: lastMsg?.direction === 'out',
        })
        archivedOnWhatsapp = archived.ok
        if (archived.ok === false) {
          console.warn('[whatsapp-archive]', archived.error)
        }
      }
    }
  }

  const { error: delErr } = await auth.supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, archived_on_whatsapp: archivedOnWhatsapp })
}
