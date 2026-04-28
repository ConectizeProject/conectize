import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: contas } = await auth.supabase
    .from('contas')
    .select('id, name, saldo_inicial_cents')
    .eq('organization_id', auth.organizationId)
    .order('name', { ascending: true })

  const { data: txRows } = await auth.supabase
    .from('financial_transactions')
    .select('conta_id, amount_cents')
    .eq('organization_id', auth.organizationId)
  const txByConta: Record<string, number> = {}
  for (const r of txRows ?? []) {
    const cid = (r as { conta_id: string }).conta_id
    const c = Number((r as { amount_cents: number }).amount_cents)
    txByConta[cid] = (txByConta[cid] ?? 0) + c
  }

  const result = (contas ?? []).map((c: { id: string; name: string; saldo_inicial_cents?: number }) => {
    const txSum = txByConta[c.id] ?? 0
    const saldoInicial = Number(c.saldo_inicial_cents ?? 0)
    return {
      id: c.id,
      name: c.name,
      saldo_inicial_cents: saldoInicial,
      balance_cents: saldoInicial + txSum,
    }
  })

  return NextResponse.json({ ok: true, contas: result })
}
