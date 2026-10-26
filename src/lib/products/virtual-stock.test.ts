import { describe, expect, it } from 'vitest'
import {
  buildVirtualKitSaleHistoryOverlays,
  computeVirtualKitCostCents,
  computeVirtualStockFromComponents,
  expandServiceOrderLinesThroughComponents,
  expandStockItemsThroughComponents,
  mergeStockMovementsByCreatedAtDesc,
  parseSkuKitMultiplier,
} from '@/lib/products/virtual-stock'

describe('parseSkuKitMultiplier', () => {
  it('lê prefixo NxBASE', () => {
    expect(parseSkuKitMultiplier('3XTMDADPTMKB', 'TMDADPTMKB')).toBe(3)
    expect(parseSkuKitMultiplier('20XTMDADPTMKB', 'TMDADPTMKB')).toBe(20)
  })

  it('lê sufixo BASE-Nx', () => {
    expect(parseSkuKitMultiplier('TMDADPTMKB-04X', 'TMDADPTMKB')).toBe(4)
    expect(parseSkuKitMultiplier('TMDADPTMKB-10X', 'TMDADPTMKB')).toBe(10)
  })

  it('ignora o SKU base e formatos inválidos', () => {
    expect(parseSkuKitMultiplier('TMDADPTMKB', 'TMDADPTMKB')).toBeNull()
    expect(parseSkuKitMultiplier('OUTRO', 'TMDADPTMKB')).toBeNull()
  })
})

describe('computeVirtualKitCostCents', () => {
  it('soma custo × quantidade de cada componente', () => {
    expect(computeVirtualKitCostCents([
      { quantityPerUnit: 3, unitCostCents: 1250 },
      { quantityPerUnit: 1, unitCostCents: 400 },
    ])).toBe(4150)
  })

  it('trata custo ausente como zero', () => {
    expect(computeVirtualKitCostCents([
      { quantityPerUnit: 2, unitCostCents: null },
    ])).toBe(0)
  })
})

describe('computeVirtualStockFromComponents', () => {
  it('usa o mínimo entre componentes', () => {
    expect(computeVirtualStockFromComponents([
      { quantityPerUnit: 3, componentStock: 10 },
      { quantityPerUnit: 1, componentStock: 2 },
    ])).toBe(2)
  })

  it('retorna 0 sem componentes ou estoque insuficiente', () => {
    expect(computeVirtualStockFromComponents([])).toBe(0)
    expect(computeVirtualStockFromComponents([
      { quantityPerUnit: 5, componentStock: 4 },
    ])).toBe(0)
  })
})

describe('expandStockItemsThroughComponents', () => {
  it('expande kit em componentes', () => {
    const componentsByProductId = new Map([
      ['kit', [
        { productId: 'kit', componentProductId: 'base', quantityPerUnit: 3 },
      ]],
    ])
    const expanded = expandStockItemsThroughComponents({
      items: [{ id: 'line-1', product_id: 'kit', quantity: 2 }],
      componentsByProductId,
    })
    expect(expanded).toEqual([
      {
        id: 'line-1',
        product_id: 'base',
        quantity: 6,
        unit_cost_cents: null,
        sourceItemId: 'line-1',
        kitProductId: 'kit',
      },
    ])
  })
})

describe('expandServiceOrderLinesThroughComponents', () => {
  it('mantém o SKU agrupador e baixa o componente', () => {
    const componentsByProductId = new Map([
      ['kit', [
        { productId: 'kit', componentProductId: 'base', quantityPerUnit: 3 },
      ]],
    ])
    const expanded = expandServiceOrderLinesThroughComponents({
      lines: [{
        productId: 'kit',
        quantity: 2,
        unitCostCents: 1000,
        description: 'Kit 3x',
      }],
      componentsByProductId,
    })
    expect([...expanded.kitProductIds]).toEqual(['kit'])
    expect(expanded.lines).toEqual(expect.arrayContaining([
      {
        productId: 'kit',
        quantity: 2,
        unitCostCents: 1000,
        description: 'Kit 3x',
      },
      {
        productId: 'base',
        quantity: 6,
        unitCostCents: 0,
        description: 'Kit 3x',
      },
    ]))
  })
})

describe('buildVirtualKitSaleHistoryOverlays', () => {
  it('omite pedidos que já têm movimento no agrupador', () => {
    const overlays = buildVirtualKitSaleHistoryOverlays({
      productId: 'kit',
      postedSalesOrderIds: ['order-1'],
      items: [
        {
          id: 'item-1',
          quantity: 2,
          unitCostCents: 150,
          salesOrderId: 'order-1',
          createdAt: '2026-10-01T10:00:00.000Z',
          orderNumber: 10,
        },
        {
          id: 'item-2',
          quantity: 1,
          unitCostCents: 150,
          salesOrderId: 'order-2',
          createdAt: '2026-10-02T10:00:00.000Z',
          orderNumber: 11,
        },
      ],
    })
    expect(overlays).toHaveLength(1)
    expect(overlays[0]).toMatchObject({
      id: 'virtual-sale:item-2',
      productId: 'kit',
      type: 'exit',
      quantity: 1,
      salesOrderId: 'order-2',
      salesOrderNumber: 11,
    })
  })
})

describe('mergeStockMovementsByCreatedAtDesc', () => {
  it('mistura overlay e movimentos reais por data', () => {
    const merged = mergeStockMovementsByCreatedAtDesc(
      [{ id: 'm1', createdAt: '2026-10-01T12:00:00.000Z' }],
      [{ id: 'virtual-sale:1', createdAt: '2026-10-02T12:00:00.000Z' }],
    )
    expect(merged.map((row) => row.id)).toEqual(['virtual-sale:1', 'm1'])
  })
})
