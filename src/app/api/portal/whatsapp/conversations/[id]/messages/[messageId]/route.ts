import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { deleteWhatsappMessageFromPortal } from '@/lib/whatsapp/delete-whatsapp-message-from-portal'

/** Remove uma mensagem do portal. Não apaga no WhatsApp. */
export async function DELETE (
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: conversationId, messageId } = await params
  if (!conversationId || !messageId) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const result = await deleteWhatsappMessageFromPortal(
    auth.supabase,
    conversationId,
    messageId,
  )

  if (result.ok === false) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
