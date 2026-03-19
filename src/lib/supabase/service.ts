import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service role (bypassa RLS).
 * Usar apenas em contexto server-side e nunca expor ao cliente.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for service client')
  }

  const normalizedKey = serviceKey.trim()
  const looksLikeAnonKey = normalizedKey.startsWith('sb_publishable') || normalizedKey.startsWith('sb_public')
  if (looksLikeAnonKey) {
    // Ajuda a diagnosticar o cenário onde a env foi configurada incorretamente em produção.
    console.error('[supabase] SUPABASE_SERVICE_ROLE_KEY parece ser publishable/anon, não service role')
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
