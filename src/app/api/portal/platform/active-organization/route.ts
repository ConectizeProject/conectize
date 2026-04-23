import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/** Define a organização ativa no portal (somente platform_admin). */
export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  if (!auth.isPlatformAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const organizationId = String(body?.organizationId || '').trim()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: 'organization_id_required' }, { status: 400 })
  }

  const { data: exists } = await auth.supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle()
  if (!exists?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { error } = await auth.supabase.from('user_portal_context').upsert({
    user_id: auth.userId,
    active_organization_id: organizationId,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
