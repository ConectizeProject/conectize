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

  const { data: paidSales } = await auth.supabase
    .from('pos_sales')
    .select('paid_amount_cents, change_cents')
    .eq('organization_id', auth.organizationId)
    .eq('cash_session_id', current.session.id)
    .eq('status', 'paid')

  const expectedCashCents = (paidSales ?? []).reduce((acc, row) => {
    const paid = Number(row.paid_amount_cents) || 0
    const change = Number(row.change_cents) || 0
    return acc + Math.max(0, paid - change)
  }, current.session.opening_amount_cents || 0)

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
    .eq('id', current.session.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true, session: data })
}

