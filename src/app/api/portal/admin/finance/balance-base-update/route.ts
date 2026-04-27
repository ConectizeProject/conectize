import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

/**
 * Corrige o balanço de uma conta sem gerar nova movimentação:
 * recalcula `saldo_inicial_cents` para que (saldo_inicial + soma das transações) == alvo.
 */
export async function POST (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const contaId = body?.conta_id
  const newBalanceCents = body?.new_balance_cents

  if (!contaId || typeof contaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'conta_id_required' }, { status: 400 })
  }
  if (newBalanceCents === undefined || newBalanceCents === null || !Number.isFinite(Number(newBalanceCents))) {
    return NextResponse.json({ ok: false, error: 'new_balance_cents_required' }, { status: 400 })
  }

  const targetCents = Math.round(Number(newBalanceCents))

  const { data: contaRow, error: contaErr } = await auth.supabase
    .from('contas')
    .select('id')
    .eq('id', contaId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (contaErr || !contaRow) {
    return NextResponse.json({ ok: false, error: 'conta_not_found' }, { status: 404 })
  }

  const { data: txRows, error: txErr } = await auth.supabase
    .from('financial_transactions')
    .select('amount_cents')
    .eq('conta_id', contaId)
    .eq('organization_id', auth.organizationId)

  if (txErr) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: txErr.message } : {}),
    }, { status: 500 })
  }

  const txSum = (txRows ?? []).reduce((s, r) => s + Number((r as { amount_cents: number }).amount_cents), 0)
  const nextSaldoInicial = targetCents - txSum

  const { data: updated, error: updErr } = await auth.supabase
    .from('contas')
    .update({
      saldo_inicial_cents: nextSaldoInicial,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contaId)
    .eq('organization_id', auth.organizationId)
    .select('id, saldo_inicial_cents')
    .single()

  if (updErr) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: updErr.message } : {}),
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    conta: updated,
    target_balance_cents: targetCents,
  })
}
