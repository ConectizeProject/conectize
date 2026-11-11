import { describe, expect, it } from 'vitest'
import {
  laterFullSoldQtyForSale,
  remanescenteFullAfterSale,
} from '@/lib/integrations/mercado-livre/order-sync'

describe('remanescenteFullAfterSale', () => {
  it('soma estoque atual com vendas Full posteriores', () => {
    expect(remanescenteFullAfterSale(7, 2)).toBe(9)
    expect(remanescenteFullAfterSale(7, 0)).toBe(7)
    expect(remanescenteFullAfterSale(10, 1)).toBe(11)
  })
})

describe('laterFullSoldQtyForSale', () => {
  const lines = [
    {
      productId: 'p1',
      orderId: 'o2',
      createdAt: '2026-11-10T12:00:00.000Z',
      quantity: 1,
    },
    {
      productId: 'p1',
      orderId: 'o3',
      createdAt: '2026-11-11T12:00:00.000Z',
      quantity: 2,
    },
    {
      productId: 'p2',
      orderId: 'o9',
      createdAt: '2026-11-11T12:00:00.000Z',
      quantity: 5,
    },
  ]

  it('soma só vendas do mesmo produto após a data', () => {
    expect(laterFullSoldQtyForSale({
      lines,
      productId: 'p1',
      orderId: 'o1',
      createdAt: '2026-11-09T12:00:00.000Z',
    })).toBe(3)
  })

  it('ignora o próprio pedido e vendas anteriores', () => {
    expect(laterFullSoldQtyForSale({
      lines,
      productId: 'p1',
      orderId: 'o2',
      createdAt: '2026-11-10T12:00:00.000Z',
    })).toBe(2)
  })
})
