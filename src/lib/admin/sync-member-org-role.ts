import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgMemberRole = 'admin' | 'staff' | 'user' | 'accountant'

/**
 * Alinha organization_members.role_in_org só na organização informada.
 * Nunca reescreve memberships de outros tenants.
 */
export async function syncMemberRoleInOrganization(
	supabase: SupabaseClient,
	opts: {
		userId: string
		organizationId: string
		roleInOrg: OrgMemberRole
		ensurePortalContext: boolean
	},
): Promise<{ ok: true } | { ok: false; error: string }> {
	const userId = String(opts.userId || '').trim()
	const organizationId = String(opts.organizationId || '').trim()
	if (!userId || !organizationId) {
		return { ok: false, error: 'invalid_id' }
	}

	const { data: membership, error: membershipError } = await supabase
		.from('organization_members')
		.select('organization_id')
		.eq('user_id', userId)
		.eq('organization_id', organizationId)
		.maybeSingle()

	if (membershipError) {
		return { ok: false, error: membershipError.message || 'db_error' }
	}
	if (!membership) {
		return { ok: true }
	}

	const { error: syncErr } = await supabase
		.from('organization_members')
		.update({ role_in_org: opts.roleInOrg })
		.eq('user_id', userId)
		.eq('organization_id', organizationId)

	if (syncErr) {
		return { ok: false, error: syncErr.message || 'db_error' }
	}

	if (opts.ensurePortalContext) {
		const { data: ctx, error: ctxError } = await supabase
			.from('user_portal_context')
			.select('active_organization_id')
			.eq('user_id', userId)
			.maybeSingle()

		if (ctxError) {
			return { ok: false, error: ctxError.message || 'db_error' }
		}
		if (!ctx?.active_organization_id) {
			const { error: upsertErr } = await supabase
				.from('user_portal_context')
				.upsert({
					user_id: userId,
					active_organization_id: organizationId,
				})
			if (upsertErr) {
				return { ok: false, error: upsertErr.message || 'db_error' }
			}
		}
	}

	return { ok: true }
}
