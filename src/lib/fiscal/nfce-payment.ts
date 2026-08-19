import type { FormaPagamentoProps } from '@brasil-fiscal/nfe'

const PAYMENT_TO_TPAG: Record<string, string> = {
  dinheiro: '01',
  credito: '03',
  debito: '04',
  pix: '17',
  outro: '99',
}

/** tPag 03 crédito e 04 débito exigem o grupo card (rejeição 391). */
const CARD_PAYMENT_CODES = new Set(['03', '04'])

export function nfceTpagFromPaymentType (paymentMethodType: unknown) {
  return PAYMENT_TO_TPAG[String(paymentMethodType || '')] || '99'
}

export function buildNfcePagamentoLine (input: {
  paymentMethodType: unknown
  amount: number
}): FormaPagamentoProps {
  const formaPagamento = nfceTpagFromPaymentType(input.paymentMethodType)
  if (CARD_PAYMENT_CODES.has(formaPagamento)) {
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
