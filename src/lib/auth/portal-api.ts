import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'

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
  /** Organização ativa (RLS / contexto do portal) */
  organizationId: string
  isPlatformAdmin: boolean
}

export type PortalAuthAdminSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
  organizationId: string
}

export type PortalAuthRetailerSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
}

/**
 * Staff **ou** lojista (útil quando uma rota precisa aceitar ambos com ramos distintos).
 * Para catálogo / tabela de preços, o projeto prefere **rotas separadas**
 * (`requireStaffOrAdmin` vs `requireRetailer`) para DTOs e campos diferentes.
 */
export type PortalAuthStaffOrRetailerSuccess =
  | ({ kind: 'staff' } & PortalAuthStaffSuccess)
  | ({ kind: 'retailer' } & PortalAuthRetailerSuccess)

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

  const rawRole = String(appUser?.role || '')
  const normalized = normalizePortalRole(appUser?.role)
  const isPlatformAdmin = rawRole === 'platform_admin'
  if (
    normalized !== 'staff'
    && normalized !== 'admin'
    && !isPlatformAdmin
  ) {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) {
    return { ok: false as const, status: 403, error: 'no_organization_context' }
  }

  const authorDisplayName =
    String(appUser?.full_name || appUser?.email || '').trim() || '(Sem nome)'

  const roleForApi: PortalStaffRole =
    isPlatformAdmin || normalized === 'admin' ? 'admin' : 'staff'

  return {
    ok: true as const,
    supabase,
    role: roleForApi,
    userId: user.id,
    authorDisplayName,
    isAdmin: normalized === 'admin' || isPlatformAdmin,
    organizationId,
    isPlatformAdmin,
  }
}

/**
 * API routes: exige sessão e papel **lojista** (`retailer`).
 */
export async function requireRetailer (): Promise<PortalAuthFailure | PortalAuthRetailerSuccess> {
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

  const normalized = normalizePortalRole(appUser?.role)
  if (normalized !== 'retailer') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
  }
}

export async function requireStaffAdminOrRetailer (): Promise<
  PortalAuthFailure | PortalAuthStaffOrRetailerSuccess
> {
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
  if (normalized === 'retailer') {
    return {
      ok: true as const,
      kind: 'retailer',
      supabase,
      userId: user.id,
    }
  }

  const rawRole = String(appUser?.role || '')
  const isPlatformAdmin = rawRole === 'platform_admin'
  if (
    normalized !== 'staff'
    && normalized !== 'admin'
    && !isPlatformAdmin
  ) {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) {
    return { ok: false as const, status: 403, error: 'no_organization_context' }
  }

  const authorDisplayName =
    String(appUser?.full_name || appUser?.email || '').trim() || '(Sem nome)'

  const roleForApi: PortalStaffRole =
    isPlatformAdmin || normalized === 'admin' ? 'admin' : 'staff'

  return {
    ok: true as const,
    kind: 'staff',
    supabase,
    role: roleForApi,
    userId: user.id,
    authorDisplayName,
    isAdmin: normalized === 'admin' || isPlatformAdmin,
    organizationId,
    isPlatformAdmin,
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

  const role = String(appUser?.role || '')
  if (role !== 'admin' && role !== 'platform_admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) {
    return { ok: false as const, status: 403, error: 'no_organization_context' }
  }

  return { ok: true as const, supabase, userId: user.id, organizationId }
}

/**
 * Server Components: redireciona se nÃ£o for admin; retorna cliente Supabase autenticado.
 */
export async function requireAdminPage () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) await redirectToPortalLogin()
    redirect('/portal/ordens')
  }
  return auth.supabase
}
