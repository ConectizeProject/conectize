import { describe, expect, it } from 'vitest'
import { isProductFiscalCorrectionError } from '@/lib/fiscal/product-fiscal-errors'

describe('isProductFiscalCorrectionError', () => {
  it('flags missing NCM/CEST/FCI as correction, not SEFAZ rejection', () => {
    expect(isProductFiscalCorrectionError('product_missing_ncm')).toBe(true)
    expect(isProductFiscalCorrectionError('cest_required')).toBe(true)
    expect(isProductFiscalCorrectionError('product_missing_fci')).toBe(true)
    expect(isProductFiscalCorrectionError('sefaz_error')).toBe(false)
    expect(isProductFiscalCorrectionError('100')).toBe(false)
  })
})
