import { describe, expect, it } from 'vitest'
import {
  allocateOrderFeeToItems,
  computeSoldItemMargin,
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

  it('calcula margem bruta e líquida', () => {
    const m = computeSoldItemMargin({
      quantity: 2,
      subtotalCents: 10_000,
      lineUnitCostCents: 3000,
      productCostCents: null,
      hasProduct: true,
      allocatedFeeCents: 500,
    })
    expect(m.costTotalCents).toBe(6000)
    expect(m.grossMarginCents).toBe(4000)
    expect(m.netMarginCents).toBe(3500)
    expect(m.netMarginPercent).toBeCloseTo(35, 5)
    expect(m.canEditCost).toBe(true)
  })

  it('sem custo → total 0 e líquido = receita − taxas', () => {
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
    expect(m.grossMarginCents).toBe(5000)
    expect(m.netMarginCents).toBe(4900)
    expect(m.feeCents).toBe(100)
    expect(m.canEditCost).toBe(true)
  })

  it('sem produto → custo 0 e ainda calcula líquido', () => {
    const m = computeSoldItemMargin({
      quantity: 1,
      subtotalCents: 2000,
      lineUnitCostCents: 0,
      productCostCents: null,
      hasProduct: false,
      allocatedFeeCents: 50,
    })
    expect(m.costTotalCents).toBe(0)
    expect(m.netMarginCents).toBe(1950)
    expect(m.canEditCost).toBe(false)
  })

  it('aloca fee proporcionalmente com resto no maior item', () => {
    expect(allocateOrderFeeToItems(100, [7000, 3000])).toEqual([70, 30])
    expect(allocateOrderFeeToItems(10, [100, 100])).toEqual([5, 5])
    expect(allocateOrderFeeToItems(101, [100, 100])).toEqual([51, 50])
  })
})
