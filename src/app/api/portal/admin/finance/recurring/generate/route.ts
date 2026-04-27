import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'

/** Gera saídas do mês atual para gastos recorrentes cujo billing_day já passou e ainda não foi gerado neste mês. */
export async function POST() {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayDay = now.getDate()

  const { data: recurringList } = await auth.supabase
    .from('recurring_expenses')
    .select('id, description, amount_cents, conta_id, billing_day, organization_id')
    .eq('is_active', true)
    .or(`last_generated_for.is.null,last_generated_for.lt.${currentMonth}`)

  let created = 0
  for (const r of recurringList ?? []) {
    const billingDay = Number((r as { billing_day: number }).billing_day)
    if (billingDay > todayDay) continue
    const id = (r as { id: string }).id
    const description = (r as { description: string }).description
    const amountCents = Number((r as { amount_cents: number }).amount_cents)
    const contaId = (r as { conta_id: string }).conta_id
    const organizationId = (r as { organization_id: string | null }).organization_id
    if (!organizationId) continue
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const occurDay = Math.min(billingDay, lastDayOfMonth)
    const occurredAt = `${currentMonth}-${String(occurDay).padStart(2, '0')}`

    const { error: insertErr } = await auth.supabase
      .from('financial_transactions')
      .insert({
        conta_id: contaId,
        organization_id: organizationId,
        amount_cents: -amountCents,
        type: 'saida',
        description: `[Recorrente] ${description}`,
        occurred_at: occurredAt,
        recurring_expense_id: id,
      })
    if (insertErr) continue

    await auth.supabase
      .from('recurring_expenses')
      .update({ last_generated_for: currentMonth, updated_at: new Date().toISOString() })
      .eq('id', id)
    created += 1
  }

  return NextResponse.json({ ok: true, generated: created })
}
