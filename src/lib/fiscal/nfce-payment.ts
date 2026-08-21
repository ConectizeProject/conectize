import type { FormaPagamentoProps } from '@brasil-fiscal/nfe'
import { nfcePaymentTypeFromCatalog } from '@/lib/fiscal/payment-method-type'

const PAYMENT_TO_TPAG: Record<string, string> = {
  dinheiro: '01',
  credito: '03',
  debito: '04',
  pix: '17',
  outro: '99',
}

/**
 * NT 2024.003 / rejeição 391: tPag 03 (crédito), 04 (débito) e 17 (PIX)
 * exigem o grupo card com pelo menos tpIntegra.
 * Sem integração TEF/POS no Conectize → tpIntegra = 2.
 */
const ELECTRONIC_PAYMENT_CODES = new Set(['03', '04', '17'])

export function nfceTpagFromPaymentType (paymentMethodType: unknown) {
  const normalized = nfcePaymentTypeFromCatalog(paymentMethodType)
  return PAYMENT_TO_TPAG[normalized] || '99'
}

export function buildNfcePagamentoLine (input: {
  paymentMethodType: unknown
  amount: number
}): FormaPagamentoProps {
  const formaPagamento = nfceTpagFromPaymentType(input.paymentMethodType)
  if (ELECTRONIC_PAYMENT_CODES.has(formaPagamento)) {
    return {
      formaPagamento,
      valor: input.amount,
      tipoIntegracao: 2,
    }
  }
  return {
    formaPagamento,
    valor: input.amount,
  }
}

/**
 * Normaliza pagamentos + troco para a NFC-e/NF-e.
 *
 * - Gross: soma(pagamentos) − troco === total → usa as linhas como estão.
 * - Net (PDV): soma(pagamentos) === total e troco > 0 → soma o troco na 1ª linha dinheiro
 *   para a SEFAZ (vPag bruto + vTroco).
 */
export function resolveNfcePaymentAmountsWithChange (input: {
  payments: Array<{ payment_method_type: string; amount_cents: number }>
  changeCents: number
  fiscalTotalCents: number
}): {
  ok: true
  amountsCents: number[]
  changeCents: number
} | {
  ok: false
  error: 'payment_totals_mismatch'
} {
  const changeCents = Math.max(0, Math.round(Number(input.changeCents) || 0))
  const fiscalTotalCents = Math.max(0, Math.round(Number(input.fiscalTotalCents) || 0))
  const baseAmounts = input.payments.map((payment) =>
    Math.max(0, Math.round(Number(payment.amount_cents) || 0)),
  )
  const paidCents = baseAmounts.reduce((sum, amount) => sum + amount, 0)

  if (paidCents - changeCents === fiscalTotalCents) {
    return { ok: true, amountsCents: baseAmounts, changeCents }
  }

  if (paidCents === fiscalTotalCents) {
    if (changeCents <= 0) {
      return { ok: true, amountsCents: baseAmounts, changeCents: 0 }
    }
    const cashIdx = input.payments.findIndex(
      (payment) => String(payment.payment_method_type || '') === 'dinheiro',
    )
    if (cashIdx < 0) {
      return { ok: false, error: 'payment_totals_mismatch' }
    }
    const amountsCents = [...baseAmounts]
    amountsCents[cashIdx] += changeCents
    return { ok: true, amountsCents, changeCents }
  }

  return { ok: false, error: 'payment_totals_mismatch' }
}
