import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

function isServiceClientBroken (error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  const code = String(error.code || '')
  return (
    code === 'PGRST301'
    || msg.includes('jwt')
    || msg.includes('invalid api key')
    || msg.includes('invalid claim')
  )
}

/**
 * Cliente para gravar hub_connections / viewers (bypass RLS quando possível).
 * Se SUPABASE_SERVICE_ROLE_KEY estiver ausente ou inválida, usa a sessão do admin.
 */
export async function getSupabaseHubWriter (
  userClient: SupabaseClient,
): Promise<SupabaseClient> {
  let svc: SupabaseClient
  try {
    svc = createSupabaseServiceClient()
  } catch {
    return userClient
  }

  const { error } = await svc.from('hub_connections').select('id').limit(1)
  if (!isServiceClientBroken(error)) return svc

  console.warn(
    '[hub-writes] service role indisponível; usando sessão autenticada:',
    error?.message || 'unknown',
  )
  return userClient
}
