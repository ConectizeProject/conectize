import { describe, expect, it } from 'vitest'
import {
  groupSoldItemsByCart,
  keepSoldItemPacksTogether,
} from '@/lib/vendas/group-sold-items-by-cart'

describe('groupSoldItemsByCart', () => {
  it('agrupa pelo pack_id e mantém itens sem pack separados', () => {
    const items = [
      { id: 'a', order: { mlPackId: 'pack-1' } },
      { id: 'b', order: { mlPackId: null } },
      { id: 'c', order: { mlPackId: 'pack-1' } },
      { id: 'd', order: { mlPackId: 'pack-2' } },
    ]
    expect(groupSoldItemsByCart(items)).toEqual([
      [
        { id: 'a', order: { mlPackId: 'pack-1' } },
        { id: 'c', order: { mlPackId: 'pack-1' } },
      ],
      [{ id: 'b', order: { mlPackId: null } }],
      [{ id: 'd', order: { mlPackId: 'pack-2' } }],
    ])
  })
})

describe('keepSoldItemPacksTogether', () => {
  it('reordena para manter o pack adjacente', () => {
    const items = [
      { id: 'a', sortAt: 3, order: { mlPackId: 'pack-1' } },
      { id: 'b', sortAt: 2, order: { mlPackId: null } },
      { id: 'c', sortAt: 1, order: { mlPackId: 'pack-1' } },
    ]
    expect(keepSoldItemPacksTogether(items).map((row) => row.id)).toEqual(['a', 'c', 'b'])
  })
})
