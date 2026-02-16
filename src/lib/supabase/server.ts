import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from './env'

/** Claims do JWT Supabase (sub = user id) */
type AuthClaims = { sub?: string; email?: string }

/**
 * Obtém o usuário autenticado via getClaims (recomendado no servidor).
 * Valida o JWT sem chamada de rede; retorna id e email dos claims.
 */
export async function getAuthUser () {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return { user: null }
  const claims = data.claims as AuthClaims
  if (!claims.sub) return { user: null }
  return {
    user: {
      id: claims.sub,
      email: claims.email ?? '',
    },
  }
}

/** Auth + role do portal. Cacheado por request para evitar fetches duplicados (layout + page). */
export const getPortalAuth = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { user: null, role: 'user' as const, fullName: '' }
  const { data: appUser } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  const role = appUser?.role || 'user'
  const fullName = String(appUser?.full_name || '').trim()
  return { user, role, fullName }
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
        } catch (err) {
          // ignore
        }
      },
    },
  })
}

