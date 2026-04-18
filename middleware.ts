import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { PORTAL_INTENDED_PATH_HEADER } from '@/lib/auth/portal-intended-path'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function copySetCookies (source: NextResponse, target: NextResponse) {
	const list = source.headers.getSetCookie?.()
	if (!list?.length) return
	for (const c of list) {
		target.headers.append('Set-Cookie', c)
	}
}

/** Rotas do portal acessíveis sem sessão (login, OAuth, cadastro, etc.). */
function isPortalAuthPublicPath (pathname: string): boolean {
	if (pathname === '/portal/login' || pathname === '/portal/cadastro') return true
	if (pathname === '/portal/redefinir-senha' || pathname === '/portal/logout') return true
	if (pathname.startsWith('/portal/auth/')) return true
	return false
}

export async function middleware (request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const intendedPath =
		pathname.startsWith('/portal')
			? `${pathname}${request.nextUrl.search}`
			: ''

	function buildRequestHeaders (): Headers {
		const h = new Headers(request.headers)
		if (intendedPath) {
			h.set(PORTAL_INTENDED_PATH_HEADER, intendedPath)
		}
		return h
	}

	let response = NextResponse.next({
		request: {
			headers: buildRequestHeaders(),
		},
	})

	const isUnderPortal = pathname === '/portal' || pathname.startsWith('/portal/')
	// Login, cadastro, OAuth, etc.: não chama Supabase no middleware — evita loop de refresh
	// (/token) e corridas com cookies inválidos ao abrir a tela de login.
	if (isUnderPortal && isPortalAuthPublicPath(pathname)) {
		return response
	}

	const { url, anonKey } = getSupabaseEnv()

	const supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll () {
				return request.cookies.getAll()
			},
			setAll (cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) =>
					request.cookies.set(name, value),
				)

				response = NextResponse.next({
					request: {
						headers: buildRequestHeaders(),
					},
				})

				cookiesToSet.forEach(({ name, value, options }) => {
					response.cookies.set(name, value, options)
				})
			},
		},
	})

	let user: Awaited<
		ReturnType<typeof supabase.auth.getUser>
	>['data']['user'] = null
	try {
		const { data, error } = await supabase.auth.getUser()
		if (!error) {
			user = data.user ?? null
		}
	} catch {
		// Rede indisponível, DNS, AuthRetryableFetchError, etc. — não bloqueia /portal/login
		user = null
	}

	if (
		!user &&
		isUnderPortal &&
		!isPortalAuthPublicPath(pathname)
	) {
		const safeIntended = assertSafePortalPath(
			`${request.nextUrl.pathname}${request.nextUrl.search}`,
		)
		const loginUrl = new URL(request.url)
		loginUrl.pathname = '/portal/login'
		loginUrl.search = ''
		loginUrl.searchParams.set('redirectTo', safeIntended)

		const redirectRes = NextResponse.redirect(loginUrl)
		copySetCookies(response, redirectRes)
		return redirectRes
	}

	return response
}

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
	],
}
