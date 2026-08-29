/**
 * Chaves `message=` na query do Hub após OAuth Mercado Livre (consumidas por HubToastClient).
 */
export function meliAuthorizeErrorToMessageKey(code: string): string {
	const c = String(code || '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')
	switch (c) {
		case 'access_denied':
			return 'meli_access_denied'
		case 'invalid_request':
			return 'meli_invalid_request'
		case 'unauthorized_client':
			return 'meli_unauthorized_client'
		case 'unsupported_response_type':
			return 'meli_unsupported_response_type'
		case 'invalid_scope':
			return 'meli_invalid_scope'
		case 'server_error':
			return 'meli_server_error'
		case 'temporarily_unavailable':
			return 'meli_temporarily_unavailable'
		default:
			return 'meli_oauth_unknown'
	}
}

export function meliTokenErrorToMessageKey(code: string): string {
	const c = String(code || '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')
	switch (c) {
		case 'invalid_grant':
			return 'meli_invalid_grant'
		case 'invalid_client':
			return 'meli_invalid_client'
		case 'invalid_request':
			return 'meli_invalid_request'
		case 'unauthorized_client':
			return 'meli_unauthorized_client'
		case 'unsupported_grant_type':
			return 'meli_unsupported_grant_type'
		case 'invalid_scope':
			return 'meli_invalid_scope'
		default:
			return 'meli_token_unknown'
	}
}

export function truncateMeliHubQueryDetail(value: string, max = 700): string {
	const t = value.trim()
	if (t.length <= max) return t
	return `${t.slice(0, max - 1)}…`
}
