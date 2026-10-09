import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateMcpKey } from '@/lib/mcp/access'
import { hashMcpToken, readBearerToken } from '@/lib/mcp/token'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export type McpActor = {
	keyId: string
	userId: string
	organizationId: string
	authorDisplayName: string
}

export async function resolveMcpActor(
	authorization: string | null,
): Promise<McpActor | null> {
	const token = readBearerToken(authorization)
	if (!token) return null

	const supabase = createSupabaseServiceClient()
	const presentedHash = hashMcpToken(token)
	const { data: row, error } = await supabase
		.from('mcp_api_keys')
		.select('id, organization_id, user_id, token_hash, revoked_at')
		.eq('token_hash', presentedHash)
		.maybeSingle()

	if (error || !row) return null
	if (evaluateMcpKey(row, presentedHash) !== 'ok') return null
	if (!row.organization_id) return null

	const allowed = await actorStillStaff(
		supabase,
		row.user_id,
		row.organization_id,
	)
	if (!allowed) return null

	await supabase
		.from('mcp_api_keys')
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', row.id)

	return {
		keyId: row.id,
		userId: row.user_id,
		organizationId: row.organization_id,
		authorDisplayName: allowed,
	}
}

async function actorStillStaff(
	supabase: SupabaseClient,
	userId: string,
	organizationId: string,
): Promise<string | null> {
	const { data: appUser, error } = await supabase
		.from('users')
		.select('role, full_name, email')
		.eq('id', userId)
		.maybeSingle()

	if (error || !appUser) return null

	const role = String(appUser.role || '')
	if (role !== 'platform_admin') {
		const { data: member, error: memberError } = await supabase
			.from('organization_members')
			.select('role_in_org')
			.eq('user_id', userId)
			.eq('organization_id', organizationId)
			.in('role_in_org', ['admin', 'staff'])
			.maybeSingle()

		if (memberError || !member) return null
	}

	return String(appUser.full_name || appUser.email || '').trim() || '(Sem nome)'
}
