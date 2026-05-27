import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { deleteWhatsappMessagesFromPortalBulk } from '@/lib/whatsapp/delete-whatsapp-message-from-portal'

/** Remove várias mensagens do portal. Body: { message_ids: string[] } */
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

  const body = await request.json().catch(() => null) as {
    message_ids?: unknown
    messageIds?: unknown
  } | null

  const raw = body?.message_ids ?? body?.messageIds
  const messageIds = Array.isArray(raw)
    ? raw.map((id) => String(id).trim()).filter(Boolean)
    : []

  if (messageIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'message_ids_required' }, { status: 400 })
  }

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const result = await deleteWhatsappMessagesFromPortalBulk(
    auth.supabase,
    conversationId,
    messageIds,
  )

  if (!result.ok) {
    const status = result.error === 'invalid_ids' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, deleted: result.deleted })
}
