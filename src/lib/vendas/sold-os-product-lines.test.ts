import { describe, expect, it } from 'vitest'
import {
  extractOsSoldProductLines,
  parseSoldOsItemId,
  recomputeServiceOrderCostTotalCents,
  soldOsItemId,
} from '@/lib/vendas/sold-os-product-lines'

describe('sold-os-product-lines', () => {
  it('extrai só produtos com sourceProductId', () => {
    const lines = extractOsSoldProductLines([
      {
        kind: 'service',
        description: 'Mão de obra',
        quantity: 1,
        unitValueCents: 5000,
        sourceProductId: null,
      },
      {
        kind: 'product',
        description: 'Tela',
        quantity: 2,
        unitValueCents: 10000,
        unitCostCents: 4000,
        sourceProductId: '399fb537-565b-42c7-8321-841f8e07f7df',
      },
      {
        kind: 'product',
        description: 'Sem vínculo',
        quantity: 1,
        unitValueCents: 100,
        sourceProductId: null,
      },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      lineIndex: 1,
      quantity: 2,
      unitValueCents: 10000,
      unitCostCents: 4000,
      productId: '399fb537-565b-42c7-8321-841f8e07f7df',
    })
  })

  it('monta e parseia id composto da OS', () => {
    const id = soldOsItemId('399fb537-565b-42c7-8321-841f8e07f7df', 3)
    expect(parseSoldOsItemId(id)).toEqual({
      orderId: '399fb537-565b-42c7-8321-841f8e07f7df',
      lineIndex: 3,
    })
    expect(parseSoldOsItemId('not-os')).toBeNull()
  })

  it('recomputa services_cost_total_cents após editar custo de produto', () => {
    const services = [
      {
        kind: 'service',
        description: 'Mão de obra',
        quantity: 1,
        unitValueCents: 8000,
        unitCostCents: 0,
        valueCents: 8000,
        costCents: 0,
      },
      {
        kind: 'product',
        description: 'Tela',
        quantity: 2,
        unitValueCents: 10000,
        unitCostCents: 4000,
        valueCents: 20000,
        costCents: 8000,
        sourceProductId: '399fb537-565b-42c7-8321-841f8e07f7df',
      },
    ]
    expect(recomputeServiceOrderCostTotalCents(services)).toBe(8000)

    services[1] = {
      ...services[1],
      unitCostCents: 5500,
      costCents: 11000,
      noCost: false,
    }
    // Serviço 0 + produto 2×5500 = 11000 (agregado usado em comissões/relatórios).
    expect(recomputeServiceOrderCostTotalCents(services)).toBe(11000)
  })
})
