import { describe, expect, it } from 'vitest'
import {
  groupSoldItemsByCart,
  keepSoldItemPacksTogether,
  mergeSameProductLines,
} from '@/lib/vendas/group-sold-items-by-cart'

describe('groupSoldItemsByCart', () => {
  it('agrupa pelo pack_id e mantém itens sem pack separados por pedido', () => {
    const items = [
      { id: 'a', order: { id: 'o1', mlPackId: 'pack-1' } },
      { id: 'b', order: { id: 'o2', mlPackId: null } },
      { id: 'c', order: { id: 'o3', mlPackId: 'pack-1' } },
      { id: 'd', order: { id: 'o4', mlPackId: 'pack-2' } },
    ]
    expect(groupSoldItemsByCart(items)).toEqual([
      [
        { id: 'a', order: { id: 'o1', mlPackId: 'pack-1' } },
        { id: 'c', order: { id: 'o3', mlPackId: 'pack-1' } },
      ],
      [{ id: 'b', order: { id: 'o2', mlPackId: null } }],
      [{ id: 'd', order: { id: 'o4', mlPackId: 'pack-2' } }],
    ])
  })

  it('agrupa produtos da mesma OS / pedido local pelo order.id', () => {
    const items = [
      { id: 'os:1:0', order: { id: 'os-1', mlPackId: null } },
      { id: 'sale-x', order: { id: 'sale-1', mlPackId: null } },
      { id: 'os:1:2', order: { id: 'os-1', mlPackId: null } },
      { id: 'os:2:0', order: { id: 'os-2', mlPackId: null } },
    ]
    expect(groupSoldItemsByCart(items)).toEqual([
      [
        { id: 'os:1:0', order: { id: 'os-1', mlPackId: null } },
        { id: 'os:1:2', order: { id: 'os-1', mlPackId: null } },
      ],
      [{ id: 'sale-x', order: { id: 'sale-1', mlPackId: null } }],
      [{ id: 'os:2:0', order: { id: 'os-2', mlPackId: null } }],
    ])
  })
})

describe('keepSoldItemPacksTogether', () => {
  it('reordena para manter o pack adjacente', () => {
    const items = [
      { id: 'a', sortAt: 3, order: { id: 'o1', mlPackId: 'pack-1' } },
      { id: 'b', sortAt: 2, order: { id: 'o2', mlPackId: null } },
      { id: 'c', sortAt: 1, order: { id: 'o3', mlPackId: 'pack-1' } },
    ]
    expect(keepSoldItemPacksTogether(items).map((row) => row.id)).toEqual(['a', 'c', 'b'])
  })

  it('reordena para manter produtos da mesma OS adjacentes', () => {
    const items = [
      { id: 'os:1:0', sortAt: 5, order: { id: 'os-1', mlPackId: null, orderNumber: 10 } },
      { id: 'other', sortAt: 4, order: { id: 'sale-9', mlPackId: null, orderNumber: 9 } },
      { id: 'os:1:1', sortAt: 3, order: { id: 'os-1', mlPackId: null, orderNumber: 10 } },
    ]
    expect(keepSoldItemPacksTogether(items).map((row) => row.id)).toEqual([
      'os:1:0',
      'os:1:1',
      'other',
    ])
  })
})

describe('mergeSameProductLines', () => {
  it('soma quantidade do mesmo produto e preserva outros', () => {
    const items = [
      { id: 'a', productId: 'p1', quantity: 1 },
      { id: 'b', productId: 'p2', quantity: 1 },
      { id: 'c', productId: 'p1', quantity: 1 },
    ]
    expect(mergeSameProductLines(items, (kept, extra) => ({
      ...kept,
      quantity: kept.quantity + extra.quantity,
    }))).toEqual([
      { id: 'a', productId: 'p1', quantity: 2 },
      { id: 'b', productId: 'p2', quantity: 1 },
    ])
  })
})
