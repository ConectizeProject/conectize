import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

/** Define a organização ativa no portal (somente platform_admin). */
export async function POST (request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'platform_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const organizationId = String(body?.organizationId || '').trim()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: 'organization_id_required' }, { status: 400 })
  }

  const { data: exists } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle()
  if (!exists?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { error } = await supabase.from('user_portal_context').upsert({
    user_id: user.id,
    active_organization_id: organizationId,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
