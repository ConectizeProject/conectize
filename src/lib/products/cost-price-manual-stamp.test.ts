import { describe, expect, it } from 'vitest'
import { shouldStampCostPriceManualEdit } from '@/lib/products/cost-price-manual-stamp'

describe('shouldStampCostPriceManualEdit', () => {
  it('não marca quando o custo não veio no patch', () => {
    expect(shouldStampCostPriceManualEdit(undefined, 5000)).toBe(false)
  })

  it('não marca quando o valor é idêntico ao cadastro', () => {
    expect(shouldStampCostPriceManualEdit(5000, 5000)).toBe(false)
    expect(shouldStampCostPriceManualEdit(null, null)).toBe(false)
  })

  it('marca quando o valor muda', () => {
    expect(shouldStampCostPriceManualEdit(8000, 5000)).toBe(true)
    expect(shouldStampCostPriceManualEdit(null, 5000)).toBe(true)
    expect(shouldStampCostPriceManualEdit(0, null)).toBe(true)
  })
})
