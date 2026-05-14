/**
 * Chaves `message=` na query do Hub após OAuth Bling (consumidas por HubToastClient).
 */
export function blingAuthorizeErrorToMessageKey (code: string): string {
  const c = String(code || '').trim().toLowerCase().replace(/\s+/g, '_')
  switch (c) {
    case 'forbidden':
      return 'bling_forbidden'
    case 'access_denied':
      return 'bling_access_denied'
    case 'invalid_request':
      return 'bling_invalid_request'
    case 'unauthorized_client':
      return 'bling_unauthorized_client'
    case 'unsupported_response_type':
      return 'bling_unsupported_response_type'
    case 'invalid_scope':
      return 'bling_invalid_scope'
    case 'server_error':
      return 'bling_server_error'
    case 'temporarily_unavailable':
      return 'bling_temporarily_unavailable'
    default:
      return 'bling_oauth_unknown'
  }
}

export function blingTokenErrorToMessageKey (code: string): string {
  const c = String(code || '').trim().toLowerCase().replace(/\s+/g, '_')
  switch (c) {
    case 'forbidden':
      return 'bling_forbidden'
    case 'invalid_grant':
      return 'bling_invalid_grant'
    case 'invalid_client':
      return 'bling_invalid_client'
    case 'invalid_request':
      return 'bling_invalid_request'
    case 'unauthorized_client':
      return 'bling_unauthorized_client'
    case 'unsupported_grant_type':
      return 'bling_unsupported_grant_type'
    case 'invalid_scope':
      return 'bling_invalid_scope'
    default:
      return 'bling_token_unknown'
  }
}

export function truncateBlingHubQueryDetail (value: string, max = 700): string {
  const t = value.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}
