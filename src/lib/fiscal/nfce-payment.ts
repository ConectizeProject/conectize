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
