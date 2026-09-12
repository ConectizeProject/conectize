import { NextRequest, NextResponse } from 'next/server'
import {
	isPortalSimulatableRole,
	PORTAL_SIMULATED_ROLE_COOKIE,
	PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-simulation'
import {
	createSupabaseRouteHandlerClient,
	getAuthUser,
} from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
	const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request)
	const { user } = await getAuthUser(supabase)
	if (!user) {
		return applyCookies(
			NextResponse.json(
				{ ok: false, error: 'not_authenticated' },
				{ status: 401 },
			),
		)
	}

	const { data: appUser } = await supabase
		.from('users')
		.select('role')
		.eq('id', user.id)
		.maybeSingle()

	if (appUser?.role !== 'platform_admin') {
		return applyCookies(
			NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }),
		)
	}

	const body = await request.json().catch(() => null)
	const role = String(body?.role || '').trim()

	if (!role || role === 'platform_admin') {
		const response = NextResponse.json({ ok: true })
		response.cookies.delete(PORTAL_SIMULATED_ROLE_COOKIE)
		return applyCookies(response)
	}

	if (!isPortalSimulatableRole(role)) {
		return applyCookies(
			NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 }),
		)
	}

	const response = NextResponse.json({ ok: true })
	response.cookies.set(
		PORTAL_SIMULATED_ROLE_COOKIE,
		role,
		PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
	)
	return applyCookies(response)
}
