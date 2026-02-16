import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ platformId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { platformId } = await params
  if (!platformId) {
    return NextResponse.json({ ok: false, error: 'platform_required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('hub_connections')
    .delete()
    .eq('platform_id', platformId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
