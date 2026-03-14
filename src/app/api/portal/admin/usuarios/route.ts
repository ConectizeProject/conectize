import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = data?.role ?? 'user'
  if (role !== 'admin') return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const, supabase }
}

/** GET /api/portal/admin/usuarios?roles=admin,staff&email=xxx */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const rolesParam = searchParams.get('roles') ?? ''
  const emailFilter = searchParams.get('email')?.trim().toLowerCase() ?? ''

  const roles = rolesParam
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter((r) => ['admin', 'staff', 'user', 'customer'].includes(r))

  // Map to DB roles: customer -> user
  const dbRoles = [...new Set(roles.map((r) => (r === 'customer' ? 'user' : r)))]

  let targetRoles = dbRoles.length > 0 ? dbRoles : ['admin', 'staff', 'user']
  if (targetRoles.includes('user')) {
    targetRoles = targetRoles.filter((r) => r !== 'user')
    targetRoles.push('user', 'customer')
    targetRoles = [...new Set(targetRoles)]
  }

  const { data: users, error } = await auth.supabase
    .from('users')
    .select('id, email, full_name, cpf, role, created_at')
    .in('role', targetRoles)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  let filtered = users ?? []
  if (emailFilter) {
    filtered = filtered.filter((u) =>
      (u.email ?? '').toLowerCase().includes(emailFilter)
    )
  }

  return NextResponse.json({ ok: true, users: filtered })
}
