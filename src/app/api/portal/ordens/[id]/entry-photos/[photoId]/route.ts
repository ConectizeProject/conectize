import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

/** DELETE: remove uma foto de entrada */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id, photoId } = await params
  if (!id || !photoId) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { data: row, error: selectError } = await auth.supabase
    .from('service_order_entry_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('service_order_id', id)
    .maybeSingle()

  if (selectError || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  await auth.supabase.storage.from('order-entry-photos').remove([row.storage_path])

  const { error: deleteError } = await auth.supabase
    .from('service_order_entry_photos')
    .delete()
    .eq('id', photoId)

  if (deleteError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
