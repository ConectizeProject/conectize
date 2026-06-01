import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getOpenCashSession } from '@/lib/pdv/service'

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const current = await getOpenCashSession(auth)
  if (!current.ok) {
    return NextResponse.json({ ok: false, error: 'cash_not_open' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const countedCashCents = Math.max(0, Number(body?.counted_cash_cents) || 0)

  const sessionId = current.session.id
  const opening = current.session.opening_amount_cents || 0

  const { data: paidOrders } = await auth.supabase
    .from('sales_orders')
    .select('id, paid_amount_cents, change_cents')
    .eq('organization_id', auth.organizationId)
    .eq('cash_session_id', sessionId)
    .eq('status', 'paid')

  const orderIds = (paidOrders ?? []).map((row) => String(row.id))

  let cashFromOrders = 0
  if (orderIds.length > 0) {
    const { data: cashPayments } = await auth.supabase
      .from('sales_order_payments')
      .select('amount_cents')
      .eq('organization_id', auth.organizationId)
      .in('sales_order_id', orderIds)
      .eq('payment_method_type', 'dinheiro')
      .neq('status', 'canceled')

    cashFromOrders = (cashPayments ?? []).reduce((acc, row) => acc + (Number(row.amount_cents) || 0), 0)
  }

  const totalChange = (paidOrders ?? []).reduce((acc, row) => acc + (Number(row.change_cents) || 0), 0)

  const { data: movements } = await auth.supabase
    .from('pos_cash_movements')
    .select('type, amount_cents')
    .eq('organization_id', auth.organizationId)
    .eq('cash_session_id', sessionId)

  let sangrias = 0
  let suprimentos = 0
  for (const mov of movements ?? []) {
    const amount = Number(mov.amount_cents) || 0
    if (mov.type === 'sangria') sangrias += amount
    if (mov.type === 'suprimento') suprimentos += amount
  }

  const expectedCashCents = opening + cashFromOrders - totalChange - sangrias + suprimentos
  const differenceCents = countedCashCents - expectedCashCents

  const { data, error } = await auth.supabase
    .from('pos_cash_sessions')
    .update({
      closed_by: auth.userId,
      closed_at: new Date().toISOString(),
      counted_cash_cents: countedCashCents,
      expected_cash_cents: expectedCashCents,
      difference_cents: differenceCents,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true, session: data })
}
