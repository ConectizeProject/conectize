import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PORTAL_INTENDED_PATH_HEADER } from './src/lib/auth/portal-intended-path'
import { resolveLegacyServiceDestination } from './src/lib/utils/legacy-service-redirect'
import {
  PORTAL_SIMULATED_ROLE_COOKIE,
  resolveEffectivePortalRole,
} from './src/lib/auth/portal-role-simulation'

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
function copyCookiesToResponse(
  source: NextResponse,
  target: NextResponse
) {
  const setCookies = source.headers.getSetCookie?.()
  if (setCookies) {
    for (const cookie of setCookies) {
      target.headers.append('Set-Cookie', cookie)
    }
  }
}

/**
 * Valida sessão via getClaims (JWT nos cookies, sem chamada ao Auth server).
 * Proxy roda em Node.js (Next.js 16+); getClaims() valida localmente.
 */
async function getUserRole(supabase: SupabaseClient, request: NextRequest) {
  const { data: claimsData } = await supabase.auth.getClaims()
  const sub = claimsData?.claims?.sub
  if (!sub) return { user: null, role: null }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', sub)
    .maybeSingle()

  // Não degrada para "user" quando a leitura de users falha/retorna vazio.
  // Isso evita redirecionamentos indevidos para /portal/minhas-ordens.
  const realRole = appUser?.role ?? null
  const simulatedRole = request.cookies.get(PORTAL_SIMULATED_ROLE_COOKIE)?.value ?? null
  const role = realRole ? resolveEffectivePortalRole(realRole, simulatedRole) : null
  return { user: { id: sub }, role, realRole }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
      pathname === '/portal/redefinir-senha'

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
          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options)
          }
        }
      }
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

    // Logged in
    if (pathname === '/portal') {
      const goMinhasOrdens = isBasicUser || isRetailer
      url.pathname = goMinhasOrdens ? '/portal/minhas-ordens' : '/portal/dashboard'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      copyCookiesToResponse(response, redirect)
      return redirect
    }

    // Lojista B2B: OS próprias, varejo, vitrine, financeiro lojista, dados
    if (isRetailer) {
      const allowedRetailer =
        pathname === '/portal/minhas-ordens' ||
        pathname.startsWith('/portal/minhas-ordens/') ||
        pathname === '/portal/complete-profile' ||
        pathname.startsWith('/portal/complete-profile/') ||
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
        pathname.startsWith('/portal/complete-profile/')

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
      if (pathname.startsWith('/portal/admin') || pathname === '/portal/hub' || pathname.startsWith('/portal/hub/')) {
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

  if (!pathname.startsWith('/servicos/')) return NextResponse.next()

  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'servicos') return NextResponse.next()

  const rest = parts.slice(1)
  if (rest.length === 0) return NextResponse.next()

  const destination = resolveLegacyServiceDestination(rest)
  if (destination) {
    const destUrl = new URL(destination, request.nextUrl.origin)
    const url = request.nextUrl.clone()
    url.pathname = destUrl.pathname
    url.search = destUrl.search
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/servicos', '/servicos/:path*', '/portal', '/portal/:path*'],
}
