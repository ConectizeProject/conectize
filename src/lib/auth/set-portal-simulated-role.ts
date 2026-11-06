'use server'

import { cookies, headers } from 'next/headers'
import {
	isPortalSimulatableRole,
	PORTAL_SIMULATED_ROLE_COOKIE,
	PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-simulation'
import { withSharedAuthCookieDomain } from '@/lib/supabase/auth-cookie-domain'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { publicHostnameFromHeaders } from '@/lib/utils/canonical-host'

export type SetPortalSimulatedRoleResult =
	| { ok: true }
	| { ok: false; error: 'not_authenticated' | 'forbidden' | 'invalid_role' }

export async function setPortalSimulatedRole(
	role: string | null | undefined,
): Promise<SetPortalSimulatedRoleResult> {
	const supabase = await createSupabaseServerClient()
	const { user } = await getAuthUser(supabase)
	if (!user) {
		return { ok: false, error: 'not_authenticated' }
	}

	const { data: appUser } = await supabase
		.from('users')
		.select('role')
		.eq('id', user.id)
		.maybeSingle()

	if (appUser?.role !== 'platform_admin') {
		return { ok: false, error: 'forbidden' }
	}

	const cookieStore = await cookies()
	const headerStore = await headers()
	const hostname = publicHostnameFromHeaders(headerStore)
	const nextRole = String(role || '').trim()

	if (!nextRole || nextRole === 'platform_admin') {
		const domainOptions = withSharedAuthCookieDomain(
			hostname,
			PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
		)
		if (domainOptions.domain) {
			cookieStore.set(PORTAL_SIMULATED_ROLE_COOKIE, '', {
				...domainOptions,
				maxAge: 0,
			})
		} else {
			cookieStore.delete(PORTAL_SIMULATED_ROLE_COOKIE)
		}
		return { ok: true }
	}

	if (!isPortalSimulatableRole(nextRole)) {
		return { ok: false, error: 'invalid_role' }
	}

	cookieStore.set(
		PORTAL_SIMULATED_ROLE_COOKIE,
		nextRole,
		withSharedAuthCookieDomain(hostname, PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS),
	)
	return { ok: true }
}
