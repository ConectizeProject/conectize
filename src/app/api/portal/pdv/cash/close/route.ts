import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  buildCashCloseSummary,
  buildClosingNotes,
  parseCountedByMethod,
} from '@/lib/pdv/cash-close-summary'
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
  const countedByMethod = parseCountedByMethod(body?.counted_by_method)

  const summaryResult = await buildCashCloseSummary(auth, current.session)
  if (!summaryResult.ok) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const { summary } = summaryResult
  const differenceCents = countedCashCents - summary.expected_cash_cents
  const notes = buildClosingNotes(summary, countedCashCents, countedByMethod)

  const { data, error } = await auth.supabase
    .from('pos_cash_sessions')
    .update({
      closed_by: auth.userId,
      closed_at: new Date().toISOString(),
      counted_cash_cents: countedCashCents,
      expected_cash_cents: summary.expected_cash_cents,
      difference_cents: differenceCents,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', current.session.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true, session: data, summary })
}
