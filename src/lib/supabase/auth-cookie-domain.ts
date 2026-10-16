import {
	PORTAL_ROLE_HINT_COOKIE,
	PORTAL_ROLE_HINT_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-hint'
import {
	PORTAL_SIMULATED_ROLE_COOKIE,
	PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS,
} from '@/lib/auth/portal-role-simulation'
import { normalizeHostname } from '@/lib/utils/canonical-host'
import { APEX_HOST, APP_HOST, CANONICAL_HOST } from '@/lib/utils/site-url'

/**
 * Domínio pai da sessão em produção.
 * O navegador envia esse cookie para www, apex e app.
 * Localhost e *.vercel.app não entram: o browser rejeitaria o Domain.
 */
export const AUTH_COOKIE_PARENT_DOMAIN = '.conectize.com.br'

/** Mesmo prazo do cookie padrão do @supabase/ssr. */
const SUPABASE_AUTH_MAX_AGE = 400 * 24 * 60 * 60

const SHARED_AUTH_HOSTS = new Set([CANONICAL_HOST, APEX_HOST, APP_HOST])

export type AuthCookieOptions = {
	domain?: string
	path?: string
	expires?: Date | number
	httpOnly?: boolean
	maxAge?: number
	sameSite?: boolean | 'lax' | 'strict' | 'none'
	secure?: boolean
	partitioned?: boolean
	priority?: 'low' | 'medium' | 'high'
	name?: string
}

/**
 * Domain do cookie de sessão, ou undefined fora de www, apex e app.
 * evolution.conectize.com.br e qualquer outro subdomínio ficam de fora
 * na hora de gravar. O browser ainda envia um cookie pai para eles.
 */
export function authCookieDomain(
	hostname: string | null | undefined,
): string | undefined {
	const host = normalizeHostname(hostname || '')
	if (!SHARED_AUTH_HOSTS.has(host)) return undefined
	return AUTH_COOKIE_PARENT_DOMAIN
}

export function withSharedAuthCookieDomain(
	hostname: string | null | undefined,
	options?: AuthCookieOptions,
): AuthCookieOptions {
	const next: AuthCookieOptions = { ...(options || {}) }
	delete next.name
	const domain = authCookieDomain(hostname)
	if (!domain) return next
	return {
		...next,
		domain,
		path: next.path || '/',
		secure: true,
	}
}

export function browserAuthCookieOptions(
	hostname: string,
	protocol: string,
):
	| {
			domain: string
			path: string
			sameSite: 'lax'
			secure: boolean
	  }
	| undefined {
	const domain = authCookieDomain(hostname)
	if (!domain) return undefined
	const proto = protocol.replace(/:$/, '').toLowerCase()
	return {
		domain,
		path: '/',
		sameSite: 'lax',
		secure: proto === 'https',
	}
}

function sameSiteAttribute(
	value: AuthCookieOptions['sameSite'],
): 'Lax' | 'Strict' | 'None' {
	if (value === true || value === 'strict') return 'Strict'
	if (value === 'none') return 'None'
	return 'Lax'
}

function serializeSetCookie(
	name: string,
	value: string,
	options: {
		domain?: string
		path?: string
		maxAge?: number
		httpOnly?: boolean
		secure?: boolean
		sameSite?: 'Lax' | 'Strict' | 'None'
	},
): string {
	const parts = [`${name}=${encodeURIComponent(value)}`]
	if (options.domain) parts.push(`Domain=${options.domain}`)
	parts.push(`Path=${options.path || '/'}`)
	if (typeof options.maxAge === 'number')
		parts.push(`Max-Age=${options.maxAge}`)
	if (options.httpOnly) parts.push('HttpOnly')
	if (options.secure) parts.push('Secure')
	if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
	return parts.join('; ')
}

function isSharedSessionCookie(name: string): boolean {
	return (
		name.startsWith('sb-') ||
		name === PORTAL_ROLE_HINT_COOKIE ||
		name === PORTAL_SIMULATED_ROLE_COOKIE
	)
}

function promotionOptions(name: string): {
	maxAge?: number
	httpOnly: boolean
} {
	if (name.startsWith('sb-')) {
		return { maxAge: SUPABASE_AUTH_MAX_AGE, httpOnly: false }
	}
	if (name === PORTAL_ROLE_HINT_COOKIE) {
		return {
			maxAge: PORTAL_ROLE_HINT_COOKIE_OPTIONS.maxAge,
			httpOnly: true,
		}
	}
	return {
		httpOnly: PORTAL_SIMULATED_ROLE_COOKIE_OPTIONS.httpOnly,
	}
}

/**
 * true quando a resposta troca de host entre www, apex e app.
 * É o momento de copiar o cookie host-only antigo para o domínio pai.
 */
export function shouldPromoteAuthCookies(
	fromHost: string,
	toHost: string,
): boolean {
	const from = normalizeHostname(fromHost)
	const to = normalizeHostname(toHost)
	if (!from || !to || from === to) return false
	return Boolean(authCookieDomain(from) && authCookieDomain(to))
}

/**
 * Set-Cookie do domínio pai e expiração do cookie host-only de mesmo nome.
 * Os dois precisam ir em headers separados: a API de cookies do Next
 * guarda um único valor por nome.
 */
export function sharedAuthPromotionHeaders(
	cookies: { name: string; value: string }[],
): string[] {
	const lines: string[] = []
	for (const cookie of cookies) {
		if (!cookie.value || !isSharedSessionCookie(cookie.name)) continue
		const opts = promotionOptions(cookie.name)
		lines.push(
			serializeSetCookie(cookie.name, cookie.value, {
				domain: AUTH_COOKIE_PARENT_DOMAIN,
				path: '/',
				maxAge: opts.maxAge,
				httpOnly: opts.httpOnly,
				secure: true,
				sameSite: 'Lax',
			}),
		)
		lines.push(
			serializeSetCookie(cookie.name, '', {
				path: '/',
				maxAge: 0,
				httpOnly: opts.httpOnly,
				secure: true,
				sameSite: 'Lax',
			}),
		)
	}
	return lines
}

type CookieResponse = {
	cookies: {
		set: (name: string, value: string, options?: AuthCookieOptions) => void
	}
	headers: { append: (name: string, value: string) => void }
}

/**
 * Grava o cookie com Domain em produção e expira a cópia host-only.
 */
export function applyAuthCookieToResponse(
	response: CookieResponse,
	hostname: string | null | undefined,
	name: string,
	value: string,
	options?: AuthCookieOptions,
): void {
	const next = withSharedAuthCookieDomain(hostname, options)
	response.cookies.set(name, value, next)
	if (!next.domain) return
	response.headers.append(
		'Set-Cookie',
		serializeSetCookie(name, '', {
			path: next.path || '/',
			maxAge: 0,
			httpOnly: Boolean(next.httpOnly),
			secure: true,
			sameSite: sameSiteAttribute(next.sameSite),
		}),
	)
}

/** Expira a cópia do domínio pai e, se existir, a cópia host-only. */
export function expireAuthCookieHeaders(
	hostname: string | null | undefined,
	name: string,
	options?: AuthCookieOptions,
): string[] {
	const path = options?.path || '/'
	const httpOnly = Boolean(options?.httpOnly)
	const sameSite = sameSiteAttribute(options?.sameSite)
	const lines = [
		serializeSetCookie(name, '', {
			path,
			maxAge: 0,
			httpOnly,
			secure: Boolean(options?.secure),
			sameSite,
		}),
	]
	const domain = authCookieDomain(hostname)
	if (!domain) return lines
	lines.unshift(
		serializeSetCookie(name, '', {
			domain,
			path,
			maxAge: 0,
			httpOnly,
			secure: true,
			sameSite,
		}),
	)
	return lines
}
