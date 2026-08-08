import { maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { cn } from '@/lib/utils'
import type {
  CartItem,
  CatalogProduct,
  OrderSummary,
  PaymentLine,
  PaymentMethod,
} from './pdv-types'

export function createCartLineId () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function cartLineDiscountPerUnit (item: CartItem) {
  const qty = Math.max(1, item.quantity)
  return Math.round(item.discountCents / qty)
}

export function cartLinesMatch (a: CartItem, b: CartItem) {
  return a.productId === b.productId
    && a.unitPriceCents === b.unitPriceCents
    && a.unitCostCents === b.unitCostCents
    && cartLineDiscountPerUnit(a) === cartLineDiscountPerUnit(b)
}

export function cartLineSubtotalCents (item: CartItem) {
  return Math.max(0, item.quantity * item.unitPriceCents - item.discountCents)
}

export function normalizePaymentType (type: PaymentMethod['type']): PaymentLine['payment_method_type'] {
  if (type === 'pix_direto' || type === 'pix_maquina') return 'pix'
  if (type === 'credito') return 'credito'
  if (type === 'debito') return 'debito'
  if (type === 'dinheiro') return 'dinheiro'
  return 'outro'
}

export function pickDefaultPaymentMethod (methods: PaymentMethod[]) {
  return methods.find((m) => m.type === 'dinheiro') ?? methods[0] ?? null
}

export function buildDefaultPaymentLine (totalCents: number, methods: PaymentMethod[]): PaymentLine {
  const method = pickDefaultPaymentMethod(methods)
  return {
    payment_method_id: method?.id ?? null,
    payment_method_type: method ? normalizePaymentType(method.type) : 'dinheiro',
    amountMasked: maskedFromCents(totalCents),
    installments: 1,
  }
}

export function paymentLineAmountCents (line: PaymentLine) {
  return moneyToCentsFromMasked(line.amountMasked) || 0
}

export function maxCreditInstallments (method: PaymentMethod | undefined) {
  if (!method || method.type !== 'credito') return 1
  const fees = Array.isArray(method.credit_installment_fees) ? method.credit_installment_fees : []
  if (fees.length === 0) return 12
  return Math.max(1, ...fees.map((fee) => Number(fee.installments) || 1))
}

export function pickAddedPaymentMethod (methods: PaymentMethod[]) {
  return methods.find((m) => normalizePaymentType(m.type) !== 'dinheiro')
    ?? methods[0]
    ?? null
}

/** Ajusta a linha de dinheiro para o restante do total (após outros métodos). */
export function redistributeCashPaymentLine (lines: PaymentLine[], totalCents: number): PaymentLine[] {
  const cashIdx = lines.findIndex((line) => line.payment_method_type === 'dinheiro')
  if (cashIdx < 0) return lines

  const others = lines.reduce((acc, line, index) => (
    index === cashIdx ? acc : acc + paymentLineAmountCents(line)
  ), 0)
  const cashAmount = Math.max(0, totalCents - others)
  if (paymentLineAmountCents(lines[cashIdx]) === cashAmount) return lines

  return lines.map((line, index) => (
    index === cashIdx
      ? { ...line, amountMasked: maskedFromCents(cashAmount) }
      : line
  ))
}

/** Limita a linha para que a soma dos métodos não ultrapasse o total. */
export function clampPaymentLineAmount (
  lines: PaymentLine[],
  idx: number,
  requestedCents: number,
  totalCents: number,
): PaymentLine[] {
  const others = lines.reduce((acc, line, index) => (
    index === idx ? acc : acc + paymentLineAmountCents(line)
  ), 0)
  const amount = Math.min(Math.max(0, requestedCents), Math.max(0, totalCents - others))
  return lines.map((line, index) => (
    index === idx
      ? { ...line, amountMasked: amount > 0 ? maskedFromCents(amount) : '' }
      : line
  ))
}

export function mergeCartItem (prev: CartItem[], newItem: CartItem) {
  const idx = prev.findIndex((item) => cartLinesMatch(item, newItem))
  if (idx < 0) {
    return [...prev, { ...newItem, lineId: newItem.lineId || createCartLineId() }]
  }
  const next = [...prev]
  next[idx] = {
    ...next[idx],
    quantity: next[idx].quantity + newItem.quantity,
    discountCents: next[idx].discountCents + newItem.discountCents,
  }
  return next
}

export function sortOrders (orders: OrderSummary[]) {
  const statusRank = { in_progress: 0, paid: 1, canceled: 2 }
  return [...orders].sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status]
    if (rankDiff !== 0) return rankDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function orderStatusChromeClass (status: OrderSummary['status'], isSelected = false) {
  if (status === 'in_progress') {
    return cn(
      'border-amber-400/70 bg-amber-50 text-amber-950 hover:bg-amber-100/80',
      'dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/60',
      isSelected && 'ring-2 ring-amber-400/50',
    )
  }
  if (status === 'canceled') {
    return 'border-red-300/80 bg-red-50/80 text-red-900/80 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-100/80'
  }
  // paid / finalizado
  return 'border-zinc-300/80 bg-zinc-100/90 text-zinc-600 dark:border-zinc-600/60 dark:bg-zinc-800/50 dark:text-zinc-300'
}

export function mapCatalogProduct (raw: Record<string, unknown>): CatalogProduct {
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    sku: raw.sku != null ? String(raw.sku) : null,
    barcode: raw.barcode != null ? String(raw.barcode) : null,
    sale_price_cents: raw.sale_price_cents != null ? Number(raw.sale_price_cents) : null,
    cost_price_cents: raw.cost_price_cents != null ? Number(raw.cost_price_cents) : null,
    image_url: raw.image_url != null ? String(raw.image_url) : null,
    stock: Number(raw.stock) || 0,
  }
}

/** Código típico de leitor (EAN/UPC/ITF) — só dígitos, 8 a 14. */
export function isLikelyBarcode (value: string) {
  const code = value.trim()
  return /^\d{8,14}$/.test(code)
}

export function customerTypeFromDocument (document: string): 'pf' | 'pj' {
  return document.replace(/\D/g, '').length > 11 ? 'pj' : 'pf'
}

export const CASH_QUICK_AMOUNTS_CENTS = [2000, 5000, 10000, 20000] as const
