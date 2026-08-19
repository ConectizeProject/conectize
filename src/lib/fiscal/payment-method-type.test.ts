import { describe, expect, it } from 'vitest'
import {
  isNfcePaymentType,
  nfcePaymentTypeFromCatalog,
} from '@/lib/fiscal/payment-method-type'

describe('nfcePaymentTypeFromCatalog', () => {
  it('maps PDV catalog types to NFC-e types', () => {
    expect(nfcePaymentTypeFromCatalog('pix_maquina')).toBe('pix')
    expect(nfcePaymentTypeFromCatalog('pix_direto')).toBe('pix')
    expect(nfcePaymentTypeFromCatalog('debito')).toBe('debito')
    expect(nfcePaymentTypeFromCatalog('voucher')).toBe('outro')
  })
})

describe('isNfcePaymentType', () => {
  it('accepts only the five NFC-e types', () => {
    expect(isNfcePaymentType('credito')).toBe(true)
    expect(isNfcePaymentType('pix_maquina')).toBe(false)
  })
})
