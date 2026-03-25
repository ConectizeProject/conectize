import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'

/**
 * Endpoint reservado para busca de OS (placeholder).
 * Mantido para compatibilidade com tipos gerados pelo Next e possíveis integrações.
 */
export async function GET () {
  const { user } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, items: [] })
}
