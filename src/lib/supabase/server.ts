import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './env'

/** Claims do JWT Supabase (sub = user id) */
type AuthClaims = { sub?: string; email?: string }

/**
 * Obtém o usuário autenticado via getClaims (recomendado no servidor).
 * Em falha de rede/DNS com o host do Supabase, retorna null sem lançar (evita TypeError no console).
 */
export async function getAuthUser () {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.getClaims()

    if (!error && data?.claims) {
      const claims = data.claims as AuthClaims
      if (claims.sub) {
        return {
          user: {
            id: claims.sub,
            email: claims.email ?? '',
          },
        }
      }
    }

    // Fallback para sessões válidas que exigem refresh no servidor.
    const userResult = await supabase.auth.getUser()
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
        msg
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
    if (!user) return { user: null, role: 'user' as const, fullName: '' }
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
    const role = appUser?.role || 'user'
    const fullName = String(appUser?.full_name || '').trim()
    return { user, role, fullName }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[portal] getPortalAuth:', msg)
    }
    return { user: null, role: 'user' as const, fullName: '' }
  }
})

export async function createSupabaseServerClient () {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll () {
        return cookieStore.getAll()
      },
      setAll (cookiesToSet) {
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

