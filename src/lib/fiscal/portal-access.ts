import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'

export type FiscalAdminAccess =
  | {
      ok: true
      supabase: SupabaseClient
      organizationId: string
      userId: string
    }
  | {
      ok: false
      status: number
      error: string
    }

export async function requireFiscalAdmin (): Promise<FiscalAdminAccess> {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false, status: 401, error: 'not_authenticated' }
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) {
    return { ok: false, status: 403, error: 'no_organization_context' }
  }

  if (appUser?.role === 'platform_admin') {
    return { ok: true, supabase, organizationId, userId: user.id }
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('role_in_org')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (member?.role_in_org !== 'admin') {
    return { ok: false, status: 403, error: 'forbidden' }
  }

  return { ok: true, supabase, organizationId, userId: user.id }
}
