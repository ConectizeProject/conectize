import { getPrintWindowFeatures } from '@/lib/ordem-print'
import {
  PAYMENT_METHOD_TYPES,
  type PaymentMethodType,
} from '@/lib/pdv/cash-close-summary'

export type OpenCashClosePrintOptions = {
  sessionId?: string | null
  sellerName?: string | null
  countedCashCents?: number | null
  countedByMethod?: Partial<Record<PaymentMethodType, number>> | null
}

export function openCashClosePrint (options: OpenCashClosePrintOptions = {}) {
  const params = new URLSearchParams()
  if (options.sessionId) params.set('session_id', options.sessionId)
  if (options.sellerName) params.set('seller', options.sellerName)
  if (options.countedCashCents != null) {
    params.set('counted_cash', String(Math.max(0, Math.round(options.countedCashCents))))
  }
  if (options.countedByMethod) {
    for (const type of PAYMENT_METHOD_TYPES) {
      if (type === 'dinheiro') continue
      const value = options.countedByMethod[type]
      if (value == null) continue
      params.set(`counted_${type}`, String(Math.max(0, Math.round(value))))
    }
  }
  const qs = params.toString()
  const url = `/api/portal/pdv/cash/close-report${qs ? `?${qs}` : ''}`
  window.open(url, '_blank', getPrintWindowFeatures())
}
