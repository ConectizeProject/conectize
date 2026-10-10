import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isSupabaseInfraError } from './lib/auth/auth-session-resilience'
import { PORTAL_INTENDED_PATH_HEADER } from './lib/auth/portal-intended-path'
import {
	isValidPortalRoleHint,
	PORTAL_ROLE_HINT_COOKIE,
} from './lib/auth/portal-role-hint'
import {
	PORTAL_SIMULATED_ROLE_COOKIE,
	resolveEffectivePortalRole,
} from './lib/auth/portal-role-simulation'
import {
	applyAuthCookieToResponse,
	sharedAuthPromotionHeaders,
	shouldPromoteAuthCookies,
} from './lib/supabase/auth-cookie-domain'
import { publicHostnameFromHeaders } from './lib/utils/canonical-host'
import {
	goneCrawlResponse,
	isGoneCrawlPath,
} from './lib/utils/gone-crawl-paths'
import {
	appSeoRewritePath,
	hostSplitRedirect,
	resolveSurface,
	SIMULATE_HOST_HEADER,
} from './lib/utils/host-surface'

function getSupabaseEnv() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
	if (!anonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')

	return { url, anonKey }
}

/**
 * Copia os cookies da resposta do Supabase para a resposta de redirect.
 * Necessário para manter a sessão ao redirecionar - sem isso o refresh token
 * pode ser perdido e o usuário é deslogado aleatoriamente.
 */
function copyCookiesToResponse(source: NextResponse, target: NextResponse) {
	const setCookies = source.headers.getSetCookie?.()
	if (setCookies) {
		for (const cookie of setCookies) {
			target.headers.append('Set-Cookie', cookie)
		}
	}
}

/**
 * Cliente Supabase no middleware com o adapter oficial: refresh grava nos
 * cookies da *request* (para o Route Handler/RSC ver o JWT novo) e da response.
 */
function createMiddlewareSupabase(request: NextRequest) {
	const { url, anonKey } = getSupabaseEnv()
	let response = NextResponse.next({ request })

	const supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll()
			},
			setAll(cookiesToSet) {
				for (const cookie of cookiesToSet) {
					request.cookies.set(cookie.name, cookie.value)
				}
				response = NextResponse.next({ request })
				const hostname = publicHostnameFromHeaders(
					request.headers,
					request.nextUrl.hostname,
				)
				for (const cookie of cookiesToSet) {
					applyAuthCookieToResponse(
						response,
						hostname,
						cookie.name,
						cookie.value,
						cookie.options,
					)
				}
			},
		},
	})

	return {
		supabase,
		getResponse: () => response,
	}
}

/** Renova a sessão nas APIs do portal (o matcher antigo não cobria `/api`). */
async function refreshPortalApiSession(request: NextRequest) {
	try {
		const { supabase, getResponse } = createMiddlewareSupabase(request)
		await supabase.auth.getClaims()
		return getResponse()
	} catch {
		return NextResponse.next()
	}
}

/**
 * Valida sessão via getClaims (JWT nos cookies, sem chamada ao Auth server).
 * Middleware/proxy roda em Node.js (Next.js 16+); getClaims() valida localmente.
 *
 * Nota: mantemos `middleware.ts` (não `proxy.ts`) por bug do Turbopack no Next 16.2.4
 * que faz rotas do matcher retornarem 404 em `next dev` com proxy.ts.
 * O arquivo fica em `src/`, no mesmo nível de `app`, para o build de produção
 * incluí-lo. Na raiz, com `src/app`, o Next 16 ignora o middleware.
 * Ver: https://github.com/vercel/next.js/issues/92921
 */
async function getUserRole(supabase: SupabaseClient, request: NextRequest) {
	const { data: claimsData } = await supabase.auth.getClaims()
	const sub = claimsData?.claims?.sub
	if (!sub) return { user: null, role: null }

	const { data: appUser, error } = await supabase
		.from('users')
		.select('role')
		.eq('id', sub)
		.maybeSingle()

	let realRole = appUser?.role ?? null
	if (!realRole && error && isSupabaseInfraError(error)) {
		const hint = request.cookies.get(PORTAL_ROLE_HINT_COOKIE)?.value ?? null
		if (isValidPortalRoleHint(hint)) {
			realRole = hint
		}
	}
	const simulatedRole =
		request.cookies.get(PORTAL_SIMULATED_ROLE_COOKIE)?.value ?? null
	const role = realRole
		? resolveEffectivePortalRole(realRole, simulatedRole)
		: null
	return { user: { id: sub }, role, realRole }
}

function simulateHostHeader(request: NextRequest): string | null {
	return (
		request.headers.get(SIMULATE_HOST_HEADER) ||
		process.env.CONECTIZE_SURFACE ||
		null
	)
}

/**
 * Um único redirect: host canônico (apex ou http → https://www), path legado
 * e separação loja (www) / SaaS (app). Redirecionar em etapas recriaria a cadeia
 * do Search Console. GET/HEAD usam 301. Os demais usam 308 para preservar o corpo.
 *
 * API, webhook, callback OAuth e assets não cruzam de host.
 * Localhost e *.vercel.app não cruzam, salvo header `x-conectize-host` ou env
 * `CONECTIZE_SURFACE` (`app` ou `www`).
 */
function redirectPublicUrl(request: NextRequest) {
	const hostname = publicHostnameFromHeaders(
		request.headers,
		request.nextUrl.hostname,
	)
	const protocol =
		request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
	const split = hostSplitRedirect({
		hostname,
		protocol,
		pathname: request.nextUrl.pathname,
		search: request.nextUrl.search,
		simulateHost: simulateHostHeader(request),
		method: request.method,
	})
	if (!split) return null
	const response = NextResponse.redirect(split.url, split.status)
	let targetHost = ''
	try {
		targetHost = new URL(split.url).hostname
	} catch {
		targetHost = ''
	}
	if (shouldPromoteAuthCookies(hostname, targetHost)) {
		for (const line of sharedAuthPromotionHeaders(request.cookies.getAll())) {
			response.headers.append('Set-Cookie', line)
		}
	}
	return response
}

function rewriteAppSeo(request: NextRequest) {
	const hostname = publicHostnameFromHeaders(
		request.headers,
		request.nextUrl.hostname,
	)
	const surface = resolveSurface(hostname, simulateHostHeader(request))
	if (surface !== 'app') return null
	const internal = appSeoRewritePath(request.nextUrl.pathname)
	if (!internal) return null
	const url = request.nextUrl.clone()
	url.pathname = internal
	return NextResponse.rewrite(url)
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl

	const normalizedPath =
		pathname.length > 1 && pathname.endsWith('/')
			? pathname.slice(0, -1)
			: pathname
	if (isGoneCrawlPath(normalizedPath)) return goneCrawlResponse()

	const publicRedirect = redirectPublicUrl(request)
	if (publicRedirect) return publicRedirect

	const appSeo = rewriteAppSeo(request)
	if (appSeo) return appSeo

	if (pathname.startsWith('/api/portal')) {
		return refreshPortalApiSession(request)
	}

	if (
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/robots.txt') ||
		pathname.startsWith('/sitemap.xml')
	) {
		return NextResponse.next()
	}

	if (pathname === '/portal' || pathname.startsWith('/portal/')) {
		const url = request.nextUrl.clone()

		// URLs legadas de seminovos → listagem unificada
		if (
			pathname === '/portal/seminovos' ||
			pathname.startsWith('/portal/seminovos/') ||
			pathname === '/portal/revendaaparelhos/seminovos' ||
			pathname.startsWith('/portal/revendaaparelhos/seminovos/')
		) {
			url.pathname = '/portal/revendaaparelhos'
			return NextResponse.redirect(url, 308)
		}

		const intendedPath = `${pathname}${request.nextUrl.search}`

		const isPublicPortalPath =
			pathname === '/portal/login' ||
			pathname === '/portal/auth/callback' ||
			pathname === '/portal/redefinir-senha' ||
			pathname === '/portal/verify-mfa' ||
			pathname.startsWith('/portal/verify-mfa/')

		const requestHeaders = new Headers(request.headers)
		requestHeaders.set(PORTAL_INTENDED_PATH_HEADER, intendedPath)

		const response = NextResponse.next({
			request: { headers: requestHeaders },
		})
		response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')

		let supabaseUrl: string
		let anonKey: string
		try {
			const env = getSupabaseEnv()
			supabaseUrl = env.url
			anonKey = env.anonKey
		} catch {
			if (isPublicPortalPath) return response

			url.pathname = '/portal/login'
			url.searchParams.set('redirectTo', pathname)
			const redirect = NextResponse.redirect(url)
			redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
			return redirect
		}

		const supabase = createServerClient(supabaseUrl, anonKey, {
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet) {
					const hostname = publicHostnameFromHeaders(
						request.headers,
						request.nextUrl.hostname,
					)
					for (const cookie of cookiesToSet) {
						request.cookies.set(cookie.name, cookie.value)
						applyAuthCookieToResponse(
							response,
							hostname,
							cookie.name,
							cookie.value,
							cookie.options,
						)
					}
				},
			},
		})

		const { user, role } = await getUserRole(supabase, request)

		if (!user) {
			if (isPublicPortalPath) return response

			url.pathname = '/portal/login'
			url.searchParams.set('redirectTo', pathname)
			const redirect = NextResponse.redirect(url)
			redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
			copyCookiesToResponse(response, redirect)
			return redirect
		}

		const isBasicUser = role === 'user' || role === 'customer'
		const isRetailer = role === 'retailer'
		const isAccountant = role === 'accountant'

		// Logged in
		if (pathname === '/portal') {
			const goMinhasOrdens = isBasicUser || isRetailer
			url.pathname = isAccountant
				? '/portal/contador'
				: goMinhasOrdens
					? '/portal/minhas-ordens'
					: '/portal/dashboard'
			url.search = ''
			const redirect = NextResponse.redirect(url)
			redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
			copyCookiesToResponse(response, redirect)
			return redirect
		}

		// Contador: só área de notas + perfil/logout
		if (isAccountant) {
			const allowedAccountant =
				pathname === '/portal/contador' ||
				pathname.startsWith('/portal/contador/') ||
				pathname === '/portal/complete-profile' ||
				pathname.startsWith('/portal/complete-profile/') ||
				pathname === '/portal/seguranca' ||
				pathname.startsWith('/portal/seguranca/') ||
				pathname === '/portal/logout'

			if (!allowedAccountant && !isPublicPortalPath) {
				url.pathname = '/portal/contador'
				url.search = ''
				const redirect = NextResponse.redirect(url)
				redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
				copyCookiesToResponse(response, redirect)
				return redirect
			}

			return response
		}

		// Lojista B2B: OS próprias, varejo, vitrine, financeiro lojista, dados
		if (isRetailer) {
			const allowedRetailer =
				pathname === '/portal/minhas-ordens' ||
				pathname.startsWith('/portal/minhas-ordens/') ||
				pathname === '/portal/complete-profile' ||
				pathname.startsWith('/portal/complete-profile/') ||
				pathname === '/portal/seguranca' ||
				pathname.startsWith('/portal/seguranca/') ||
				pathname.startsWith('/portal/ordens/') ||
				pathname === '/portal/revendaaparelhos' ||
				pathname === '/portal/revendaaparelhos/' ||
				pathname === '/portal/revendaaparelhos/listagem' ||
				pathname.startsWith('/portal/revendaaparelhos/listagem/') ||
				/^\/portal\/revendaaparelhos\/[^/]+\/vitrine\/?$/.test(pathname) ||
				pathname === '/portal/financeiro-lojista' ||
				pathname.startsWith('/portal/financeiro-lojista/')

			if (!allowedRetailer && !isPublicPortalPath) {
				url.pathname = '/portal/minhas-ordens'
				url.search = ''
				const redirect = NextResponse.redirect(url)
				redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
				copyCookiesToResponse(response, redirect)
				return redirect
			}

			return response
		}

		// Cliente: só pode ver as próprias OS (+ completar perfil)
		if (isBasicUser) {
			const allowed =
				pathname === '/portal/minhas-ordens' ||
				pathname.startsWith('/portal/minhas-ordens/') ||
				pathname === '/portal/complete-profile' ||
				pathname.startsWith('/portal/complete-profile/') ||
				pathname === '/portal/seguranca' ||
				pathname.startsWith('/portal/seguranca/')

			if (!allowed && !isPublicPortalPath) {
				url.pathname = '/portal/minhas-ordens'
				url.search = ''
				const redirect = NextResponse.redirect(url)
				redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
				copyCookiesToResponse(response, redirect)
				return redirect
			}

			return response
		}

		// Staff: não pode admin nem hub
		if (role === 'staff') {
			if (
				pathname.startsWith('/portal/admin') ||
				pathname === '/portal/hub' ||
				pathname.startsWith('/portal/hub/')
			) {
				url.pathname = '/portal/ordens'
				url.search = ''
				const redirect = NextResponse.redirect(url)
				redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
				copyCookiesToResponse(response, redirect)
				return redirect
			}
			return response
		}

		// Admin: acesso total
		return response
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		// Quase tudo, inclusive sitemap, robots e arquivos públicos, para o apex
		// ir a https://www num único salto. _next/static e _next/image ficam de fora.
		'/((?!_next/static|_next/image).*)',
	],
}
