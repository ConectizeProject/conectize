import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/**
 * Retorna se o ChatGPT está conectado no HUB (sem expor a API key).
 * Usado para exibir "Ajuda com IA" nos formulários de OS.
 */
export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
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
