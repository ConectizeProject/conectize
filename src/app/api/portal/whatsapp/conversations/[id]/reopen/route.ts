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

  const { error } = await auth.supabase
    .from('whatsapp_conversations')
    .update({ needs_staff_attention: true })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
