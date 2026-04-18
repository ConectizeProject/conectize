import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET (
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

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!conv) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: messages, error } = await auth.supabase
    .from('whatsapp_messages')
    .select(
      'id, direction, body, status, resolved_by, needs_human, wa_message_id, created_at, payload',
    )
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messages: messages || [] })
}
