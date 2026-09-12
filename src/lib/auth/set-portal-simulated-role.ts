'use server'

import { cookies } from 'next/headers'
import {
	isPortalSimulatableRole,
	PORTAL_SIMULATED_ROLE_COOKIE,
	PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-simulation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

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
	const nextRole = String(role || '').trim()

	if (!nextRole || nextRole === 'platform_admin') {
		cookieStore.delete(PORTAL_SIMULATED_ROLE_COOKIE)
		return { ok: true }
	}

	if (!isPortalSimulatableRole(nextRole)) {
		return { ok: false, error: 'invalid_role' }
	}

	cookieStore.set(
		PORTAL_SIMULATED_ROLE_COOKIE,
		nextRole,
		PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
	)
	return { ok: true }
}
