import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { FINALIZED_ORDER_STATUS_SET } from '@/lib/orders/order-status'

export type OrderFinanceInput = {
  id: string
  display_number: number | null
  status: string
  services_total_cents: number | null
  services_cost_total_cents: number | null
  payment_methods: unknown
  updated_at?: string | null
  closed_at?: string | null
}

export function sumPaymentMethodsValueCents (raw: unknown): number {
  if (raw == null) return 0
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      arr = Array.isArray(p) ? p : []
    } catch {
      return 0
    }
  }
  let sum = 0
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue
    const row = e as { payment_method_id?: unknown; value_cents?: unknown }
    if (!parseOptionalUuid(row.payment_method_id)) continue
    if (row.value_cents != null) {
      sum += Math.max(0, Number(row.value_cents) || 0)
    }
  }
  return sum
}

export type EnrichedOrderFinance = OrderFinanceInput & {
  valorPagoCents: number
  valorEmAbertoCents: number
  financeLabel: 'pago' | 'pendente'
}

export function enrichOrderFinance (order: OrderFinanceInput): EnrichedOrderFinance {
  const total = Math.max(0, Number(order.services_total_cents) || 0)
  const paid = sumPaymentMethodsValueCents(order.payment_methods)
  const open = Math.max(0, total - paid)
  const financeLabel: 'pago' | 'pendente' =
    total > 0 && paid >= total ? 'pago' : 'pendente'
  return {
    ...order,
    valorPagoCents: paid,
    valorEmAbertoCents: open,
    financeLabel,
  }
}

/** Lista financeira: só OS com status final (fluxo encerrado operacionalmente). */
export function filterOrdersForFinanceList<T extends { status: string }> (rows: T[]): T[] {
  return rows.filter((r) => FINALIZED_ORDER_STATUS_SET.has(r.status))
}

export function sumOpenCents (rows: EnrichedOrderFinance[]): number {
  return rows.reduce((acc, r) => acc + r.valorEmAbertoCents, 0)
}
