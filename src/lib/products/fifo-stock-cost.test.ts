import { describe, expect, it } from 'vitest'
import {
  buildFifoLayers,
  consumeFifoCost,
  resolveFifoUnitCostCents,
} from '@/lib/products/fifo-stock-cost'

describe('fifo-stock-cost', () => {
  it('monta camadas após entradas e saídas', () => {
    const layers = buildFifoLayers([
      { type: 'entry', quantity: 10, unitValueCents: 1000 },
      { type: 'entry', quantity: 5, unitValueCents: 2000 },
      { type: 'exit', quantity: 8, unitValueCents: 0 },
    ])
    expect(layers).toEqual([
      { qty: 2, unitCostCents: 1000 },
      { qty: 5, unitCostCents: 2000 },
    ])
  })

  it('consome o estoque mais antigo primeiro', () => {
    const layers = buildFifoLayers([
      { type: 'entry', quantity: 3, unitValueCents: 1000 },
      { type: 'entry', quantity: 3, unitValueCents: 3000 },
    ])
    const result = consumeFifoCost(layers, 4, 0)
    // 3x1000 + 1x3000 = 6000 → unit 1500
    expect(result.totalCostCents).toBe(6000)
    expect(result.unitCostCents).toBe(1500)
    expect(result.layers).toEqual([{ qty: 2, unitCostCents: 3000 }])
  })

  it('usa fallback quando não há camadas suficientes', () => {
    const layers = buildFifoLayers([
      { type: 'entry', quantity: 1, unitValueCents: 1000 },
    ])
    const result = consumeFifoCost(layers, 3, 500)
    // 1x1000 + 2x500 = 2000 → unit 667
    expect(result.totalCostCents).toBe(2000)
    expect(result.unitCostCents).toBe(667)
  })

  it('sem estoque → usa custo do produto (FIFO não se aplica)', () => {
    const result = consumeFifoCost([], 2, 1500)
    expect(result.usedFifo).toBe(false)
    expect(result.unitCostCents).toBe(1500)
    expect(result.totalCostCents).toBe(3000)
  })

  it('sem estoque após consumo histórico → custo do produto', () => {
    expect(
      resolveFifoUnitCostCents(
        [
          { type: 'entry', quantity: 2, unitValueCents: 1000 },
          { type: 'exit', quantity: 2, unitValueCents: 1000 },
        ],
        1,
        2500,
      ),
    ).toBe(2500)
  })
})
