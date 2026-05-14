/** Datas no fuso local (competência / vencimento no calendário do usuário). */

export function localYmd (d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function localYm (d: Date): string {
  return localYmd(d).slice(0, 7)
}

export function addMonthsYm (ym: string, delta: number): string {
  const [y, mo] = ym.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function dueDateForMonthYm (ym: string, billingDay: number): string {
  const [y, mo] = ym.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  const day = Math.min(billingDay, lastDay)
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysUntilDue (todayYmd: string, dueYmd: string): number {
  const a = new Date(`${todayYmd}T12:00:00`)
  const b = new Date(`${dueYmd}T12:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function recurringDueStatusLabel (daysUntil: number): string {
  if (daysUntil < 0) return 'Atrasada'
  if (daysUntil === 0) return 'Vence hoje'
  if (daysUntil === 1) return 'Vence amanhã'
  if (daysUntil === 2) return 'Vence em 2 dias'
  if (daysUntil === 3) return 'Vence em 3 dias'
  return `Vence em ${daysUntil} dias`
}

export type RecurringRowInput = {
  id: string
  description: string
  amount_cents: number
  conta_id: string
  billing_day: number
  is_active: boolean
  last_generated_for: string | null
  contas?: { name: string } | { name: string }[] | null
}

function contaNameFromRow (row: RecurringRowInput): string | null {
  const c = row.contas
  if (!c) return null
  if (Array.isArray(c)) return c[0]?.name ?? null
  return c.name ?? null
}

export type RecurringPendingDto = {
  id: string
  description: string
  amount_cents: number
  conta_id: string
  conta_name: string | null
  billing_day: number
  is_active: boolean
  competency_month: string
  due_date: string
  days_until: number
  status_label: string
  /** Alerta compacto (dashboard): até 3 dias antes do vencimento ou já atrasada. */
  show_compact_alert: boolean
}

export function computeRecurringPending (row: RecurringRowInput, today: Date): RecurringPendingDto {
  const todayYmd = localYmd(today)
  const todayYm = localYm(today)
  const last = row.last_generated_for
  const competencyMonth = last ? addMonthsYm(last, 1) : todayYm
  const dueDate = dueDateForMonthYm(competencyMonth, row.billing_day)
  const daysUntil = daysUntilDue(todayYmd, dueDate)
  const statusLabel = recurringDueStatusLabel(daysUntil)
  const show_compact_alert = daysUntil <= 3
  return {
    id: row.id,
    description: row.description,
    amount_cents: row.amount_cents,
    conta_id: row.conta_id,
    conta_name: contaNameFromRow(row),
    billing_day: row.billing_day,
    is_active: row.is_active,
    competency_month: competencyMonth,
    due_date: dueDate,
    days_until: daysUntil,
    status_label: statusLabel,
    show_compact_alert: show_compact_alert,
  }
}

export function mapRecurringRowsToPending (rows: RecurringRowInput[], today: Date): RecurringPendingDto[] {
  return rows.map((r) => computeRecurringPending(r, today))
}

/**
 * Lista resumida (financeiro / alertas): competência no mês corrente
 * ou vencimento em até 3 dias (inclui hoje e atrasadas).
 */
export function recurringInvoiceVisibleInShortList (p: RecurringPendingDto, today: Date): boolean {
  if (p.competency_month === localYm(today)) return true
  if (p.days_until <= 3) return true
  return false
}
