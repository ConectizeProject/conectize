import { describe, expect, it } from 'vitest'
import { buildNfcePagamentoLine, nfceTpagFromPaymentType } from '@/lib/fiscal/nfce-payment'

describe('nfceTpagFromPaymentType', () => {
  it('maps PDV types to SEFAZ tPag', () => {
    expect(nfceTpagFromPaymentType('dinheiro')).toBe('01')
    expect(nfceTpagFromPaymentType('credito')).toBe('03')
    expect(nfceTpagFromPaymentType('debito')).toBe('04')
    expect(nfceTpagFromPaymentType('pix')).toBe('17')
    expect(nfceTpagFromPaymentType('outro')).toBe('99')
  })
})

describe('buildNfcePagamentoLine', () => {
  it('sends tpIntegra 2 for credit and debit', () => {
    expect(buildNfcePagamentoLine({ paymentMethodType: 'debito', amount: 95 })).toEqual({
      formaPagamento: '04',
      valor: 95,
      tipoIntegracao: 2,
    })
    expect(buildNfcePagamentoLine({ paymentMethodType: 'credito', amount: 10 })).toEqual({
      formaPagamento: '03',
      valor: 10,
      tipoIntegracao: 2,
    })
  })

  it('omits card data for cash and pix', () => {
    expect(buildNfcePagamentoLine({ paymentMethodType: 'pix', amount: 20 })).toEqual({
      formaPagamento: '17',
      valor: 20,
    })
    expect(buildNfcePagamentoLine({ paymentMethodType: 'dinheiro', amount: 5 })).toEqual({
      formaPagamento: '01',
      valor: 5,
    })
  })
})
