import { tokenHashMatches } from '@/lib/mcp/token'

export type McpKeyRecord = {
	id: string
	organization_id: string | null
	user_id: string
	token_hash: string
	revoked_at: string | null
}

export type McpKeyDecision = 'ok' | 'missing' | 'revoked' | 'org_missing'

export function evaluateMcpKey(
	row: McpKeyRecord | null,
	presentedHash: string,
): McpKeyDecision {
	if (!row || !tokenHashMatches(row.token_hash, presentedHash)) return 'missing'
	if (row.revoked_at) return 'revoked'
	if (!row.organization_id) return 'org_missing'
	return 'ok'
}
