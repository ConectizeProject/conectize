export const PORTAL_SIMULATED_ROLE_COOKIE = 'portal_simulated_role'

export const PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production',
	path: '/',
}

export const PORTAL_SIMULATABLE_ROLES = [
	'admin',
	'staff',
	'retailer',
	'user',
	'accountant',
] as const

export type PortalSimulatableRole = (typeof PORTAL_SIMULATABLE_ROLES)[number]

export function normalizePortalRole(role: string | null | undefined): string {
	const normalized = role || 'user'
	return normalized === 'customer' ? 'user' : normalized
}

export function isPortalSimulatableRole(
	role: string | null | undefined,
): role is PortalSimulatableRole {
	return PORTAL_SIMULATABLE_ROLES.includes(role as PortalSimulatableRole)
}

export function resolveEffectivePortalRole(
	realRole: string | null | undefined,
	simulatedRole: string | null | undefined,
): string {
	const normalizedRealRole = normalizePortalRole(realRole)
	if (realRole === 'platform_admin' && isPortalSimulatableRole(simulatedRole)) {
		return simulatedRole
	}
	return normalizedRealRole
}
