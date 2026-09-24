import { describe, expect, it } from 'vitest'
import {
  allocateOrderFeeToItems,
  allocateOrderShippingToItems,
  computeSoldItemMargin,
  computeTaxCents,
  resolveEffectiveUnitCostCents,
} from '@/lib/vendas/sold-item-margin'

describe('sold-item-margin', () => {
  it('sem produto → custo nulo', () => {
    expect(
      resolveEffectiveUnitCostCents({
        hasProduct: false,
        lineUnitCostCents: 1000,
        productCostCents: 2000,
      }),
    ).toBeNull()
  })

  it('com produto: prioriza custo da linha', () => {
    expect(
      resolveEffectiveUnitCostCents({
        hasProduct: true,
        lineUnitCostCents: 1500,
        productCostCents: 2000,
      }),
    ).toBe(1500)
  })

  it('com produto: usa custo do produto se linha for 0', () => {
    expect(
      resolveEffectiveUnitCostCents({
        hasProduct: true,
        lineUnitCostCents: 0,
        productCostCents: 2200,
      }),
    ).toBe(2200)
  })

  it('com produto sem custo → nulo no unitário', () => {
    expect(
      resolveEffectiveUnitCostCents({
        hasProduct: true,
        lineUnitCostCents: 0,
        productCostCents: null,
      }),
    ).toBeNull()
  })

  it('calcula lucro bruto e margem de contribuição', () => {
    const m = computeSoldItemMargin({
      quantity: 2,
      subtotalCents: 10_000,
      lineUnitCostCents: 3000,
      productCostCents: null,
      hasProduct: true,
      allocatedShippingCents: 200,
      allocatedFeeCents: 500,
      feeDetails: [{ label: 'Cartão', amountCents: 500 }],
      marginTaxPercent: 0,
      hasAuthorizedFiscalDoc: false,
    })
    expect(m.costTotalCents).toBe(6000)
    expect(m.shippingCents).toBe(200)
    expect(m.feeCents).toBe(500)
    expect(m.grossProfitCents).toBe(9300)
    expect(m.taxCents).toBe(0)
    expect(m.contributionMarginCents).toBe(3300)
    expect(m.contributionMarginPercent).toBeCloseTo(33, 5)
    expect(m.canEditCost).toBe(true)
    expect(m.feeDetails).toEqual([{ label: 'Cartão', amountCents: 500 }])
  })

  it('aplica imposto só com NF autorizada', () => {
    const withNf = computeSoldItemMargin({
      quantity: 1,
      subtotalCents: 10_000,
      lineUnitCostCents: 2000,
      productCostCents: null,
      hasProduct: true,
      allocatedFeeCents: 0,
      marginTaxPercent: 10,
      hasAuthorizedFiscalDoc: true,
    })
    expect(withNf.taxCents).toBe(1000)
    expect(withNf.grossProfitCents).toBe(10_000)
    expect(withNf.contributionMarginCents).toBe(7000)

    const withoutNf = computeSoldItemMargin({
      quantity: 1,
      subtotalCents: 10_000,
      lineUnitCostCents: 2000,
      productCostCents: null,
      hasProduct: true,
      allocatedFeeCents: 0,
      marginTaxPercent: 10,
      hasAuthorizedFiscalDoc: false,
    })
    expect(withoutNf.taxCents).toBe(0)
    expect(withoutNf.contributionMarginCents).toBe(8000)
  })

  it('sem custo → total 0 e MC = lucro bruto − imposto', () => {
    const m = computeSoldItemMargin({
      quantity: 1,
      subtotalCents: 5000,
      lineUnitCostCents: 0,
      productCostCents: 0,
      hasProduct: true,
      allocatedFeeCents: 100,
    })
    expect(m.effectiveUnitCostCents).toBeNull()
    expect(m.costTotalCents).toBe(0)
    expect(m.grossProfitCents).toBe(4900)
    expect(m.contributionMarginCents).toBe(4900)
    expect(m.feeCents).toBe(100)
    expect(m.canEditCost).toBe(true)
  })

  it('sem produto → custo 0 e ainda calcula MC', () => {
    const m = computeSoldItemMargin({
      quantity: 1,
      subtotalCents: 2000,
      lineUnitCostCents: 0,
      productCostCents: null,
      hasProduct: false,
      allocatedFeeCents: 50,
    })
    expect(m.costTotalCents).toBe(0)
    expect(m.contributionMarginCents).toBe(1950)
    expect(m.canEditCost).toBe(false)
  })

  it('computeTaxCents arredonda e respeita flags', () => {
    expect(computeTaxCents(10_000, 9.5, true)).toBe(950)
    expect(computeTaxCents(10_000, 9.5, false)).toBe(0)
    expect(computeTaxCents(0, 10, true)).toBe(0)
  })

  it('aloca fee proporcionalmente com resto no maior item', () => {
    expect(allocateOrderFeeToItems(100, [7000, 3000])).toEqual([70, 30])
    expect(allocateOrderFeeToItems(10, [100, 100])).toEqual([5, 5])
    expect(allocateOrderFeeToItems(101, [100, 100])).toEqual([51, 50])
  })

  it('aloca frete com a mesma regra', () => {
    expect(allocateOrderShippingToItems(50, [8000, 2000])).toEqual([40, 10])
  })
})
