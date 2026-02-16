import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseServiceProductSlug } from './src/lib/utils/service-product-slug'
import { brands, services } from './src/lib/data/services'
import { buildServiceProductSlug } from './src/lib/utils/service-product-slug'

const serviceSlugs = new Set(services.map(s => s.slug))
const brandSlugs = new Set(Object.keys(brands))

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return { url, anonKey }
}

/**
 * Valida sessão via getClaims (JWT nos cookies, sem chamada ao Auth server).
 * getUser() no Edge pode falhar mesmo com cookies corretos; getClaims() valida localmente.
 */
async function getUserRole(supabase: SupabaseClient) {
  const { data: claimsData } = await supabase.auth.getClaims()
  const sub = claimsData?.claims?.sub
  if (!sub) return { user: null, role: null }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', sub)
    .maybeSingle()

  const role = appUser?.role || 'user'
  return { user: { id: sub }, role }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next()
  }

  if (pathname === '/portal') {
    // deixa a lógica de redirect do /portal centralizada no bloco abaixo
  }

  if (pathname === '/portal' || pathname.startsWith('/portal/')) {
    const url = request.nextUrl.clone()

    const isPublicPortalPath =
      pathname === '/portal/login' ||
      pathname === '/portal/auth/callback' ||
      pathname === '/portal/redefinir-senha'

    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')

    let supabaseUrl: string
    let anonKey: string
    try {
      const env = getSupabaseEnv()
      supabaseUrl = env.url
      anonKey = env.anonKey
    } catch (err) {
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

    const { user, role } = await getUserRole(supabase)

    if (!user) {
      if (isPublicPortalPath) return response

      url.pathname = '/portal/login'
      url.searchParams.set('redirectTo', pathname)
      const redirect = NextResponse.redirect(url)
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      return redirect
    }

    const isBasicUser = role === 'user' || role === 'customer' || !role

    // Logged in
    if (pathname === '/portal') {
      url.pathname = isBasicUser ? '/portal/minhas-ordens' : '/portal/dashboard'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      return redirect
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
        return redirect
      }
      return response
    }

    // Admin: acesso total
    return response
  }

  if (!pathname.startsWith('/servicos/')) return NextResponse.next()

  const parts = pathname.split('/').filter(Boolean)
  // ['servicos', ...]
  if (parts[0] !== 'servicos') return NextResponse.next()

  const rest = parts.slice(1)
  if (rest.length === 0) return NextResponse.next()

  // Nova rota já no formato /servicos/<slug-unico>
  if (rest.length === 1) {
    const slug = rest[0]
    const parsed = parseServiceProductSlug(slug)
    if (parsed.isValid) return NextResponse.next()

    // /servicos/<servico> (rota antiga) -> /servicos?servico=<servico>
    if (serviceSlugs.has(slug)) {
      const url = request.nextUrl.clone()
      url.pathname = '/servicos'
      url.searchParams.set('servico', slug)
      url.searchParams.delete('page')
      return NextResponse.redirect(url, 308)
    }

    return NextResponse.next()
  }

  // /servicos/<marca>/<servico>/<modelo> (estrutura anterior nova)
  if (rest.length === 3) {
    const [marca, servico, modelo] = rest
    if (brandSlugs.has(marca) && serviceSlugs.has(servico)) {
      const url = request.nextUrl.clone()
      url.pathname = `/servicos/${buildServiceProductSlug({ serviceSlug: servico, brandSlug: marca, modelSlug: modelo })}`
      url.search = ''
      return NextResponse.redirect(url, 308)
    }
  }

  // /servicos/<marca>/<servico> (estrutura anterior nova)
  if (rest.length === 2) {
    const [marca, servico] = rest
    if (brandSlugs.has(marca) && serviceSlugs.has(servico)) {
      const url = request.nextUrl.clone()
      url.pathname = '/servicos'
      url.searchParams.set('marca', marca)
      url.searchParams.set('servico', servico)
      url.searchParams.delete('modelo')
      url.searchParams.delete('page')
      return NextResponse.redirect(url, 308)
    }
  }

  // /servicos/<servico>/<marca>/<tipo>/<modelo> (estrutura antiga original)
  if (rest.length === 4) {
    const [servico, marca, _tipo, modelo] = rest
    if (serviceSlugs.has(servico) && brandSlugs.has(marca)) {
      const url = request.nextUrl.clone()
      url.pathname = `/servicos/${buildServiceProductSlug({ serviceSlug: servico, brandSlug: marca, modelSlug: modelo })}`
      url.search = ''
      return NextResponse.redirect(url, 308)
    }
  }

  // /servicos/<servico>/<marca>/<tipo> ou /servicos/<servico>/<marca>
  if (rest.length === 3 || rest.length === 2) {
    const servico = rest[0]
    const marca = rest[1]
    if (serviceSlugs.has(servico) && brandSlugs.has(marca)) {
      const url = request.nextUrl.clone()
      url.pathname = '/servicos'
      url.searchParams.set('marca', marca)
      url.searchParams.set('servico', servico)
      url.searchParams.delete('modelo')
      url.searchParams.delete('page')
      return NextResponse.redirect(url, 308)
    }
  }

  // Mantém querystring normal
  if (pathname === '/servicos' && searchParams.has('page')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/servicos/:path*', '/portal/:path*'],
}

