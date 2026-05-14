import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

/**
 * Antes gerava lançamentos automaticamente ao carregar o financeiro.
 * Agora a baixa é manual em POST .../recurring/settle. Mantemos a rota
 * para compatibilidade (retorno vazio, sem efeitos).
 */
export async function POST () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({ ok: true, generated: 0, manual_settle: true })
}
