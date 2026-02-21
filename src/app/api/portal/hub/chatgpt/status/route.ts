import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalized = role === 'customer' ? 'user' : role
  if (normalized === 'user') return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const, supabase }
}

/**
 * Retorna se o ChatGPT está conectado no HUB (sem expor a API key).
 * Usado para exibir "Ajuda com IA" nos formulários de OS.
 */
export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, connected: false, error: auth.error }, { status: auth.status })
  }

  const { data } = await auth.supabase
    .from('hub_connections')
    .select('id')
    .eq('platform_id', 'chatgpt')
    .not('api_key', 'is', null)
    .maybeSingle()

  return NextResponse.json({ ok: true, connected: Boolean(data?.id) })
}
