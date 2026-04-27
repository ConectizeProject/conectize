import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const contaId = body?.conta_id ?? null
  const newBalanceCents = body?.new_balance_cents
  const description = body?.description != null ? String(body.description).trim() : 'Ajuste de saldo'

  if (!contaId || typeof contaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'conta_id_required' }, { status: 400 })
  }
  if (newBalanceCents === undefined || newBalanceCents === null || !Number.isFinite(Number(newBalanceCents))) {
    return NextResponse.json({ ok: false, error: 'new_balance_cents_required' }, { status: 400 })
  }

  const targetCents = Number(newBalanceCents)

  const { data: txRows } = await auth.supabase
    .from('financial_transactions')
    .select('amount_cents')
    .eq('conta_id', contaId)
  const txSum = (txRows ?? []).reduce((s, r) => s + Number((r as { amount_cents: number }).amount_cents), 0)

  const { data: contaRow } = await auth.supabase
    .from('contas')
    .select('saldo_inicial_cents')
    .eq('id', contaId)
    .maybeSingle()
  const saldoInicial = Number((contaRow as { saldo_inicial_cents?: number } | null)?.saldo_inicial_cents ?? 0)

  const currentBalance = saldoInicial + txSum
  const diff = targetCents - currentBalance
  if (diff === 0) {
    return NextResponse.json({ ok: true, message: 'Saldo jÃ¡ estÃ¡ correto', transaction: null })
  }

  const { data: transaction, error } = await auth.supabase
    .from('financial_transactions')
    .insert({
      conta_id: contaId,
      organization_id: auth.organizationId,
      amount_cents: diff,
      type: 'ajuste',
      description: description || 'Ajuste de saldo',
      occurred_at: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: error.message } : {}),
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction })
}
