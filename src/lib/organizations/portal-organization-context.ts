import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Garante `user_portal_context.active_organization_id` preenchido quando o usuário tem membership.
 * Usado no layout do portal para RLS (`current_organization_id()` no Postgres).
 */
export async function ensurePortalOrganizationContext (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: ctx } = await supabase
    .from('user_portal_context')
    .select('active_organization_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (ctx?.active_organization_id) {
    return String(ctx.active_organization_id)
  }

  const { data: firstMember } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  const orgId = firstMember?.organization_id
  if (!orgId) return null

  await supabase.from('user_portal_context').upsert({
    user_id: userId,
    active_organization_id: orgId,
  })

  return String(orgId)
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
