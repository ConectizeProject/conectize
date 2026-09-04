import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import {
	isSupabaseInfraError,
	userFromAuthClaims,
} from '@/lib/auth/auth-session-resilience'
import {
	isValidPortalRoleHint,
	PORTAL_ROLE_HINT_COOKIE,
	PORTAL_ROLE_HINT_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-hint'
import {
	isPortalSimulatableRole,
	PORTAL_SIMULATED_ROLE_COOKIE,
	resolveEffectivePortalRole,
} from '@/lib/auth/portal-role-simulation'
import { getSupabaseEnv } from './env'

/** Claims do JWT Supabase (sub = user id) */
type AuthClaims = { sub?: string; email?: string }

/**
 * Obtém o usuário autenticado via getClaims (recomendado no servidor).
 * Em falha de rede/DNS com o host do Supabase, retorna null sem lançar (evita TypeError no console).
 */
export async function getAuthUser() {
	try {
		const supabase = await createSupabaseServerClient()
		const { data, error } = await supabase.auth.getClaims()

		const userFromClaims = userFromAuthClaims(
			data?.claims as AuthClaims | undefined,
		)
		if (!error && userFromClaims) {
			return { user: userFromClaims }
		}

		// Claims ausentes: só tenta getUser remoto se não for falha de rede.
		if (error && isSupabaseInfraError(error)) {
			return { user: null }
		}

		const userResult = await supabase.auth.getUser()
		if (userResult.error && isSupabaseInfraError(userResult.error)) {
			return { user: null }
		}
		if (!userResult.error && userResult.data.user) {
			return {
				user: {
					id: userResult.data.user.id,
					email: userResult.data.user.email ?? '',
				},
			}
		}

		return { user: null }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		if (process.env.NODE_ENV === 'development') {
			console.warn(
				'[supabase] getAuthUser indisponível (rede/DNS ou URL). Confira NEXT_PUBLIC_SUPABASE_URL.',
				msg,
			)
		}
		return { user: null }
	}
}

/** Auth + role do portal. Cacheado por request para evitar fetches duplicados (layout + page). */
export const getPortalAuth = cache(async () => {
	try {
		const supabase = await createSupabaseServerClient()
		const { user } = await getAuthUser()
		if (!user) {
			return {
				user: null,
				role: 'user' as const,
				realRole: 'user' as const,
				simulatedRole: null as string | null,
				fullName: '',
			}
		}
		const { ensurePortalOrganizationContext } = await import(
			'@/lib/organizations/portal-organization-context'
		)
		await ensurePortalOrganizationContext(supabase, user.id)
		const { data: appUser, error } = await supabase
			.from('users')
			.select('role, full_name')
			.eq('id', user.id)
			.maybeSingle()
		if (error && process.env.NODE_ENV === 'development') {
			console.warn('[supabase] users lookup:', error.message)
		}
		const cookieStore = await cookies()
		let realRole = appUser?.role || null
		if (!realRole && error && isSupabaseInfraError(error)) {
			const hint = cookieStore.get(PORTAL_ROLE_HINT_COOKIE)?.value ?? null
			if (isValidPortalRoleHint(hint)) {
				realRole = hint
			}
		}
		if (!realRole) realRole = 'user'
		if (appUser?.role && isValidPortalRoleHint(appUser.role)) {
			try {
				cookieStore.set(
					PORTAL_ROLE_HINT_COOKIE,
					appUser.role,
					PORTAL_ROLE_HINT_COOKIE_OPTIONS,
				)
			} catch {
				// Server Components podem não permitir set de cookie.
			}
		}
		const simulatedRoleRaw =
			cookieStore.get(PORTAL_SIMULATED_ROLE_COOKIE)?.value || null
		const simulatedRole = isPortalSimulatableRole(simulatedRoleRaw)
			? simulatedRoleRaw
			: null
		const role = resolveEffectivePortalRole(realRole, simulatedRole)
		const fullName = String(appUser?.full_name || '').trim()
		return { user, role, realRole, simulatedRole, fullName }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		if (process.env.NODE_ENV === 'development') {
			console.warn('[portal] getPortalAuth:', msg)
		}
		if (isSupabaseInfraError(err)) {
			try {
				const supabase = await createSupabaseServerClient()
				const { data } = await supabase.auth.getClaims()
				const degradedUser = userFromAuthClaims(
					data?.claims as AuthClaims | undefined,
				)
				if (degradedUser) {
					const cookieStore = await cookies()
					const hint = cookieStore.get(PORTAL_ROLE_HINT_COOKIE)?.value ?? null
					const realRole = isValidPortalRoleHint(hint) ? hint : 'user'
					const simulatedRoleRaw =
						cookieStore.get(PORTAL_SIMULATED_ROLE_COOKIE)?.value || null
					const simulatedRole = isPortalSimulatableRole(simulatedRoleRaw)
						? simulatedRoleRaw
						: null
					const role = resolveEffectivePortalRole(realRole, simulatedRole)
					return {
						user: degradedUser,
						role,
						realRole,
						simulatedRole,
						fullName: '',
					}
				}
			} catch {
				// ignore secondary failure
			}
		}
		return {
			user: null,
			role: 'user' as const,
			realRole: 'user' as const,
			simulatedRole: null as string | null,
			fullName: '',
		}
	}
})

export async function createSupabaseServerClient() {
	const { url, anonKey } = getSupabaseEnv()
	const cookieStore = await cookies()

	return createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll()
			},
			setAll(cookiesToSet) {
				// Em Server Components, set pode falhar; em Route Handlers/Server Actions funciona.
				try {
					for (const cookie of cookiesToSet) {
						cookieStore.set(cookie.name, cookie.value, cookie.options)
					}
				} catch {
					// ignore
				}
			},
		},
	})
}
