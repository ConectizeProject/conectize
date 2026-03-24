import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

export type PortalStaffRole = 'staff' | 'admin'

export type PortalAuthFailure = {
  ok: false
  status: number
  error: string
}

export type PortalAuthStaffSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  role: PortalStaffRole
  userId: string
  /** Nome para autor em comentÃ¡rios (OS) */
  authorDisplayName: string
  isAdmin: boolean
}

export type PortalAuthAdminSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
}

/**
 * Normaliza papel do portal: `customer` é tratado como usuário final (mesmo que `user`).
 */
export function normalizePortalRole (role: string | null | undefined): string {
  const r = role || 'user'
  return r === 'customer' ? 'user' : r
}

/**
 * API routes: exige sessÃ£o e papel staff ou admin.
 */
export async function requireStaffOrAdmin (): Promise<PortalAuthFailure | PortalAuthStaffSuccess> {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false as const, status: 401, error: 'not_authenticated' }
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const normalized = normalizePortalRole(appUser?.role)
  if (normalized !== 'staff' && normalized !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  const authorDisplayName =
    String(appUser?.full_name || appUser?.email || '').trim() || '(Sem nome)'

  return {
    ok: true as const,
    supabase,
    role: normalized as PortalStaffRole,
    userId: user.id,
    authorDisplayName,
    isAdmin: normalized === 'admin',
  }
}

/**
 * API routes: exige sessÃ£o e papel admin.
 */
export async function requireAdmin (): Promise<PortalAuthFailure | PortalAuthAdminSuccess> {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false as const, status: 401, error: 'not_authenticated' }
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase, userId: user.id }
}

/**
 * Server Components: redireciona se nÃ£o for admin; retorna cliente Supabase autenticado.
 */
export async function requireAdminPage () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) redirect('/portal/login')
    redirect('/portal/ordens')
  }
  return auth.supabase
}
