import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { enrichWhatsappMessagesWithMediaUrls } from '@/lib/whatsapp/enrich-whatsapp-message-media-urls'

/** Assina URLs de mídia em lote (segunda fase após listagem rápida com ?media=0). */
export async function POST (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: conversationId } = await params
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  let messageIds: string[] = []
  try {
    const body = await request.json()
    if (Array.isArray(body?.messageIds)) {
      messageIds = body.messageIds.map((x: unknown) => String(x)).filter(Boolean).slice(0, 50)
    }
  } catch {
    messageIds = []
  }

  if (messageIds.length === 0) {
    return NextResponse.json({ ok: true, urls: {} })
  }

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id, organization_id, hub_connection_id, conversation_key')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.organization_id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: rows, error } = await auth.supabase
    .from('whatsapp_messages')
    .select('id, wa_message_id, direction, body, status, resolved_by, needs_human, created_at, deleted_at, payload')
    .eq('conversation_id', conversationId)
    .in('id', messageIds)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const messageRows = rows || []

  const enriched = await enrichWhatsappMessagesWithMediaUrls(
    auth.supabase,
    messageRows as Array<Record<string, unknown>>,
    { includeMediaUrls: true },
  )

  const urls: Record<string, { media_url: string | null; media_expired: boolean }> = {}
  for (const m of enriched) {
    urls[m.id] = { media_url: m.media_url, media_expired: m.media_expired }
  }

  return NextResponse.json({ ok: true, urls })
}
