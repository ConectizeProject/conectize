import type { PaymentMethodEntry } from '@/components/orders/OrderPaymentMethodFields'
import { maskedFromCents } from '@/lib/utils/money'

export type SalesPaymentMethodType = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'

export type PaymentMethodCatalogLike = {
  id: string
  type: string
}

export type SalesPaymentPayload = {
  payment_method_id: string
  payment_method_type: SalesPaymentMethodType
  amount_cents: number
  status: 'paid'
  installments: number
}

export function normalizeSalesPaymentType (type: string): SalesPaymentMethodType {
  if (type === 'pix_direto' || type === 'pix_maquina' || type === 'pix') return 'pix'
  if (type === 'credito') return 'credito'
  if (type === 'debito') return 'debito'
  if (type === 'dinheiro') return 'dinheiro'
  return 'outro'
}

export function paymentEntriesToSalesPayload (
  entries: PaymentMethodEntry[],
  catalog: PaymentMethodCatalogLike[],
): SalesPaymentPayload[] {
  return entries
    .map((entry) => {
      const method = catalog.find((row) => row.id === entry.payment_method_id)
      if (!method || !entry.payment_method_id) return null
      const amountCents = Math.max(0, Number(entry.value_cents) || 0)
      if (amountCents <= 0) return null
      return {
        payment_method_id: entry.payment_method_id,
        payment_method_type: normalizeSalesPaymentType(method.type),
        amount_cents: amountCents,
        status: 'paid' as const,
        installments: Math.max(1, Number(entry.installments) || 1),
      }
    })
    .filter((entry): entry is SalesPaymentPayload => Boolean(entry))
}

export function paymentsTotalCents (entries: PaymentMethodEntry[]) {
  return entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.value_cents) || 0), 0)
}

export function emptyPaymentEntry (): PaymentMethodEntry {
  return { payment_method_id: '', installments: 1, value_cents: null }
}

export function paymentEntryWithAmount (
  amountCents: number,
  method?: PaymentMethodCatalogLike | null,
): PaymentMethodEntry {
  return {
    payment_method_id: method?.id || '',
    installments: 1,
    value_cents: amountCents > 0 ? amountCents : null,
  }
}

/** Converte payload de vendas/PDV legado (amount mascarado) para entries do componente. */
export function maskedPaymentsToEntries (
  payments: Array<{
    payment_method_id?: string | null
    amountMasked?: string
    amount_cents?: number
    installments?: number
  }>,
): PaymentMethodEntry[] {
  if (payments.length === 0) return [emptyPaymentEntry()]
  return payments.map((payment) => ({
    payment_method_id: String(payment.payment_method_id || ''),
    installments: Math.max(1, Number(payment.installments) || 1),
    value_cents: payment.amount_cents != null
      ? Math.max(0, Number(payment.amount_cents) || 0)
      : null,
  }))
}

export function entriesLabelAmount (entry: PaymentMethodEntry) {
  return maskedFromCents(Math.max(0, Number(entry.value_cents) || 0))
}
