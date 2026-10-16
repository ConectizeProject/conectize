import { describe, expect, it } from 'vitest'
import {
  salesListHref,
  salesListSectionFromPath,
} from '@/lib/vendas/sales-list-session'

describe('sales list session', () => {
  it('reconhece só as listagens de pedidos e produtos', () => {
    expect(salesListSectionFromPath('/portal/vendas')).toBe('pedidos')
    expect(salesListSectionFromPath('/portal/vendas/produtos')).toBe('produtos')
    expect(salesListSectionFromPath('/portal/vendas/123')).toBeNull()
  })

  it('monta o endereço da última exibição', () => {
    expect(salesListHref({ section: 'produtos', lane: 'preparing' })).toBe(
      '/portal/vendas/produtos?lane=preparing',
    )
    expect(salesListHref({ section: 'pedidos', lane: 'all' })).toBe('/portal/vendas')
  })
})
