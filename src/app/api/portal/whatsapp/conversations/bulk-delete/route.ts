import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { deleteWhatsappConversationsFromPortalBulk } from '@/lib/whatsapp/delete-whatsapp-conversations-from-portal'

/** Remove várias conversas do portal. Body: { conversation_ids: string[] } */
export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    conversation_ids?: unknown
    conversationIds?: unknown
  } | null

  const raw = body?.conversation_ids ?? body?.conversationIds
  const conversationIds = Array.isArray(raw)
    ? raw.map((id) => String(id).trim()).filter(Boolean)
    : []

  if (conversationIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'conversation_ids_required' }, { status: 400 })
  }

  const result = await deleteWhatsappConversationsFromPortalBulk(
    auth.supabase,
    auth.organizationId,
    conversationIds,
  )

  if (result.ok === false) {
    const status = result.error === 'invalid_ids' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, deleted: result.deleted })
}
