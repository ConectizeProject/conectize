/** Papel em cache para degradação quando o PostgREST/Supabase está indisponível. */
export const PORTAL_ROLE_HINT_COOKIE = 'portal_role_hint'

const VALID_ROLE_HINTS = new Set([
	'platform_admin',
	'admin',
	'staff',
	'retailer',
	'user',
	'customer',
])

export function isValidPortalRoleHint(
	value: string | null | undefined,
): boolean {
	if (!value) return false
	return VALID_ROLE_HINTS.has(value)
}

export const PORTAL_ROLE_HINT_COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production',
	path: '/',
	maxAge: 60 * 60 * 24 * 30,
}
