import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/** Remove conversa e mensagens do portal (cascade). Não apaga no WhatsApp. */
export async function DELETE (
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

  const { data: row, error: findErr } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { error: delErr } = await auth.supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
