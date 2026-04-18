import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

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

  const { error: u1 } = await auth.supabase
    .from('whatsapp_conversations')
    .update({ needs_staff_attention: false })
    .eq('id', id)

  if (u1) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const { error: u2 } = await auth.supabase
    .from('whatsapp_messages')
    .update({
      status: 'attended',
      resolved_by: 'human',
      needs_human: false,
    })
    .eq('conversation_id', id)
    .eq('status', 'pending')

  if (u2) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
