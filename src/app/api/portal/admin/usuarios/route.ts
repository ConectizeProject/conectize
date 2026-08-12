import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

type OrgRow = { id: string; slug: string; name: string | null; is_host: boolean }

/** GET /api/portal/admin/usuarios?roles=admin,staff&email=xxx */
export async function GET (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const rolesParam = searchParams.get('roles') ?? ''
  const emailFilter = searchParams.get('email')?.trim().toLowerCase() ?? ''

  const roles = rolesParam
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter((r) => ['admin', 'staff', 'user', 'customer', 'retailer'].includes(r))

  const dbRoles = [...new Set(roles.map((r) => (r === 'customer' ? 'user' : r)))]

  let targetRoles = dbRoles.length > 0 ? dbRoles : ['admin', 'staff', 'user']
  if (targetRoles.includes('user')) {
    targetRoles = targetRoles.filter((r) => r !== 'user')
    targetRoles.push('user', 'customer')
    targetRoles = [...new Set(targetRoles)]
  }
  if (dbRoles.includes('retailer')) {
    targetRoles = [...new Set([...targetRoles, 'retailer'])]
  }

  const { data: me } = await auth.supabase
    .from('users')
    .select('role')
    .eq('id', auth.userId)
    .maybeSingle()

  const isPlatformAdmin = String(me?.role || '') === 'platform_admin'

  let currentOrg: OrgRow | null = null
  if (isPlatformAdmin) {
    const { data: org } = await auth.supabase
      .from('organizations')
      .select('id, slug, name, is_host')
      .eq('id', auth.organizationId)
      .maybeSingle()
    currentOrg = (org as OrgRow | null) ?? null
  }

  const { data: members } = await auth.supabase
    .from('organization_members')
    .select('user_id, organization_id')
    .eq('organization_id', auth.organizationId)

  const memberIds = new Set((members ?? []).map((m) => String(m.user_id)))

  const { data: users, error } = await auth.supabase
    .from('users')
    .select('id, email, full_name, cpf, role, created_at')
    .in('role', targetRoles)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  let filtered = (users ?? []).filter((u) => memberIds.has(u.id))
  if (emailFilter) {
    filtered = filtered.filter((u) =>
      (u.email ?? '').toLowerCase().includes(emailFilter)
    )
  }

  const enriched = filtered.map((u) => ({
    ...u,
    organization_id: auth.organizationId,
    organization_name: currentOrg?.name ?? currentOrg?.slug ?? null,
    organization_slug: currentOrg?.slug ?? null,
  }))

  return NextResponse.json({ ok: true, users: enriched })
}
