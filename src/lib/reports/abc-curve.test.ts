import { describe, expect, it } from 'vitest'
import { abcItemsForMode, classifyAbc, type AbcSkuRow } from './abc-curve'

describe('classifyAbc', () => {
  it('separa A até 80%, B até 95% e o restante em C', () => {
    const slices = classifyAbc([
      { id: 'a', name: 'A', sku: null, revenueCents: 7800 },
      { id: 'b', name: 'B', sku: null, revenueCents: 1800 },
      { id: 'c', name: 'C', sku: null, revenueCents: 400 },
    ])
    expect(slices.map((slice) => slice.className)).toEqual(['A', 'B', 'C'])
    expect(slices[0]?.skuCount).toBe(1)
    expect(slices[0]?.percent).toBe(78)
    expect(slices[1]?.percent).toBe(18)
    expect(slices[2]?.percent).toBe(4)
  })

  it('mantém o primeiro item em A mesmo quando ele sozinho passa de 80%', () => {
    const slices = classifyAbc([
      { id: 'a', name: 'A', sku: null, revenueCents: 90 },
      { id: 'b', name: 'B', sku: null, revenueCents: 10 },
    ])
    expect(slices[0]?.skuCount).toBe(1)
    expect(slices[1]?.className).toBe('B')
    expect(slices[1]?.skuCount).toBe(1)
  })
})

describe('abcItemsForMode', () => {
  it('soma as variações no produto pai', () => {
    const rows: AbcSkuRow[] = [
      {
        id: 'v1',
        name: 'Capa Azul',
        sku: 'CAPA-AZ',
        parentId: 'pai',
        parentName: 'Capa',
        parentSku: 'CAPA',
        revenueCents: 100,
      },
      {
        id: 'v2',
        name: 'Capa Preta',
        sku: 'CAPA-PR',
        parentId: 'pai',
        parentName: 'Capa',
        parentSku: 'CAPA',
        revenueCents: 50,
      },
      {
        id: 'simples',
        name: 'Película',
        sku: 'PEL',
        parentId: null,
        parentName: null,
        parentSku: null,
        revenueCents: 20,
      },
    ]
    const grouped = abcItemsForMode(rows, 'product')
    expect(grouped).toEqual([
      { id: 'pai', name: 'Capa', sku: 'CAPA', revenueCents: 150 },
      { id: 'simples', name: 'Película', sku: 'PEL', revenueCents: 20 },
    ])
  })
})
