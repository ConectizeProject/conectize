import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  computeRecurringPending,
  localYmd,
  type RecurringRowInput,
} from '@/lib/finance/recurring-due'

export async function POST (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const recurringId = body?.recurring_expense_id ?? body?.id
  const paidAtRaw = body?.paid_at ?? body?.payment_date

  if (!recurringId || typeof recurringId !== 'string') {
    return NextResponse.json({ ok: false, error: 'recurring_expense_id_required' }, { status: 400 })
  }

  const paidAt = typeof paidAtRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw.trim())
    ? paidAtRaw.trim()
    : localYmd(new Date())

  const { data: row, error: loadErr } = await auth.supabase
    .from('recurring_expenses')
    .select('id, description, amount_cents, conta_id, billing_day, is_active, last_generated_for, organization_id')
    .eq('id', recurringId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (loadErr || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const r = row as RecurringRowInput & { organization_id: string }
  const pending = computeRecurringPending(r, new Date())
  const competencyMonth = pending.competency_month
  const previousLast = r.last_generated_for

  if (previousLast && previousLast >= competencyMonth) {
    return NextResponse.json({ ok: false, error: 'already_settled_for_month' }, { status: 409 })
  }

  const amountCents = Number(r.amount_cents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  const { data: inserted, error: insertErr } = await auth.supabase
    .from('financial_transactions')
    .insert({
      conta_id: r.conta_id,
      organization_id: r.organization_id,
      amount_cents: -amountCents,
      type: 'saida',
      description: `[Recorrente] ${r.description}`,
      occurred_at: paidAt,
      recurring_expense_id: recurringId,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      ...(process.env.NODE_ENV === 'development' ? { message: insertErr?.message } : {}),
    }, { status: 500 })
  }

  const insertedId = inserted.id

  let updQuery = auth.supabase
    .from('recurring_expenses')
    .update({
      last_generated_for: competencyMonth,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recurringId)
    .eq('organization_id', auth.organizationId)

  updQuery = previousLast == null
    ? updQuery.is('last_generated_for', null)
    : updQuery.eq('last_generated_for', previousLast)

  const { data: updatedRows, error: updErr } = await updQuery.select('id')

  if (updErr) {
    await auth.supabase.from('financial_transactions').delete().eq('id', insertedId)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!updatedRows?.length) {
    await auth.supabase.from('financial_transactions').delete().eq('id', insertedId)
    return NextResponse.json({ ok: false, error: 'concurrent_update' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, competency_month: competencyMonth, paid_at: paidAt })
}
