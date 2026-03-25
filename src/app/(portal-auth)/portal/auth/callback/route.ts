import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/supabase/env'

/**
 * OAuth callback - troca o código por sessão no servidor.
 * Coleta os cookies de sessão em setAll e grava diretamente na resposta de
 * redirect (Next.js pode não mesclar cookies de cookies() em redirect).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/portal'
  const safeRedirect = redirectTo.startsWith('/portal') ? redirectTo : '/portal'

  if (!code) {
    return NextResponse.redirect(
      new URL(`/portal/login?error=missing_code`, requestUrl.origin)
    )
  }

  const cookieStore = await cookies()
  const redirectUrl = new URL(safeRedirect, requestUrl.origin)
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const { url, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }))
      },
      setAll(cookies) {
        for (const c of cookies) {
          cookiesToSet.push({
            name: c.name,
            value: c.value,
            options: (c.options || {}) as Record<string, unknown>,
          })
        }
      },
    },
  })

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(
        new URL(
          `/portal/login?error=${encodeURIComponent(error.message)}`,
          requestUrl.origin
        )
      )
    }

    const response = NextResponse.redirect(redirectUrl)
    const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
    for (const { name, value, options } of cookiesToSet) {
      const opts = { ...(options || {}) } as Record<string, unknown>
      delete opts.name
      if (isLocalhost && requestUrl.protocol === 'http:') {
        opts.secure = false
      }
      opts.path = opts.path ?? '/'
      response.cookies.set(
        name,
        value,
        opts as NonNullable<Parameters<typeof response.cookies.set>[2]>,
      )
    }
    return response
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err)
    return NextResponse.redirect(
      new URL(
        `/portal/login?error=${encodeURIComponent('Erro ao completar login.')}`,
        requestUrl.origin
      )
    )
  }
}
