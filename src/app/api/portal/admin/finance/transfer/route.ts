import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const fromContaId = body?.from_conta_id ?? null
  const toContaId = body?.to_conta_id ?? null
  const amountCents = body?.amount_cents != null ? Number(body.amount_cents) : null
  const description = body?.description != null ? String(body.description).trim() : 'TransferÃªncia entre contas'

  if (!fromContaId || typeof fromContaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'from_conta_id_required' }, { status: 400 })
  }
  if (!toContaId || typeof toContaId !== 'string') {
    return NextResponse.json({ ok: false, error: 'to_conta_id_required' }, { status: 400 })
  }
  if (fromContaId === toContaId) {
    return NextResponse.json({ ok: false, error: 'same_conta' }, { status: 400 })
  }
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  const { data: activeContas, error: contasError } = await auth.supabase
    .from('contas')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .in('id', [fromContaId, toContaId])

  if (contasError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if ((activeContas ?? []).length !== 2) {
    return NextResponse.json({ ok: false, error: 'invalid_conta' }, { status: 400 })
  }

  const transferId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const today = new Date().toISOString().slice(0, 10)

  const { data: inserted, error } = await auth.supabase
    .from('financial_transactions')
    .insert([
      {
        conta_id: fromContaId,
        organization_id: auth.organizationId,
        amount_cents: -amountCents,
        type: 'transferencia',
        description: description || 'TransferÃªncia (origem)',
        occurred_at: today,
        transfer_id: transferId,
      },
      {
        conta_id: toContaId,
        organization_id: auth.organizationId,
        amount_cents: amountCents,
        type: 'transferencia',
        description: description || 'TransferÃªncia (destino)',
        occurred_at: today,
        transfer_id: transferId,
      },
    ])
    .select()

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: error.message } : {}),
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transfer_id: transferId, transactions: inserted })
}
