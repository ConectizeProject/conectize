import type { SupabaseClient } from '@supabase/supabase-js'

function normalizePortalRole (role: string | null | undefined): string {
  const r = role || 'user'
  return r === 'customer' ? 'user' : r
}

async function pickHostOrFirstOrganizationId (supabase: SupabaseClient): Promise<string | null> {
  const { data: hostOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('is_host', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (hostOrg?.id) return String(hostOrg.id)
  const { data: anyOrg } = await supabase
    .from('organizations')
    .select('id')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  return anyOrg?.id ? String(anyOrg.id) : null
}

/**
 * Garante `user_portal_context.active_organization_id` coerente com RLS:
 * - platform_admin ou admin **sem** nenhuma linha em `organization_members`: escopo global
 *   no portal (mantém org ativa ou usa org host / primeira org).
 * - staff/admin com membership: só orgs em que `role_in_org` é `admin` ou `staff` na org ativa.
 * - retailer: alinha ao `customers.organization_id` do vínculo em `customer_portal_members`.
 */
export async function ensurePortalOrganizationContext (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const rawRole = String(appUser?.role || '')
  const normalized = normalizePortalRole(appUser?.role)
  const isPlatformAdmin = rawRole === 'platform_admin'

  const { data: ctx } = await supabase
    .from('user_portal_context')
    .select('active_organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  const activeId = ctx?.active_organization_id ? String(ctx.active_organization_id) : null

  const { data: anyMembershipRow } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const hasAnyOrgMembership = Boolean(anyMembershipRow?.organization_id)

  const globalPortalScope =
    isPlatformAdmin || (normalized === 'admin' && !hasAnyOrgMembership)

  const { data: staffMemberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .in('role_in_org', ['admin', 'staff'])
    .order('organization_id', { ascending: true })

  const staffOrgIds = new Set(
    (staffMemberships || []).map((r) => String(r.organization_id)),
  )

  const firstStaffOrg = [...staffOrgIds].sort()[0] ?? null

  async function persistOrg (orgId: string) {
    await supabase.from('user_portal_context').upsert({
      user_id: userId,
      active_organization_id: orgId,
    })
    return orgId
  }

  if (globalPortalScope) {
    if (activeId) return activeId
    const fallback = await pickHostOrFirstOrganizationId(supabase)
    if (fallback) return await persistOrg(fallback)
    return null
  }

  if (normalized === 'retailer') {
    const { data: cpm } = await supabase
      .from('customer_portal_members')
      .select('customers(organization_id)')
      .eq('user_id', userId)
      .maybeSingle()

    const custRaw = cpm?.customers as
      | { organization_id?: string | null }
      | { organization_id?: string | null }[]
      | null
      | undefined
    const custOrg = Array.isArray(custRaw)
      ? custRaw[0]?.organization_id
      : custRaw?.organization_id
    const retailerOrg = custOrg ? String(custOrg) : null

    if (retailerOrg) {
      if (activeId !== retailerOrg) await persistOrg(retailerOrg)
      return retailerOrg
    }

    if (activeId) return activeId
    if (firstStaffOrg) return await persistOrg(firstStaffOrg)
    return null
  }

  if (normalized !== 'staff' && normalized !== 'admin') {
    return activeId
  }

  if (activeId && staffOrgIds.has(activeId)) {
    return activeId
  }

  if (firstStaffOrg) {
    return await persistOrg(firstStaffOrg)
  }

  if (activeId) {
    await supabase.from('user_portal_context').upsert({
      user_id: userId,
      active_organization_id: null,
    })
  }
  return null
}

export async function getPortalOrganizationId (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: ctx } = await supabase
    .from('user_portal_context')
    .select('active_organization_id')
    .eq('user_id', userId)
    .maybeSingle()
  return ctx?.active_organization_id ? String(ctx.active_organization_id) : null
}
