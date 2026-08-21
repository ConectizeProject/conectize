import { describe, expect, it } from 'vitest'
import { salesOrderItemStockExternalReference } from '@/lib/sales-orders/service'

describe('salesOrderItemStockExternalReference', () => {
  it('gera referência estável por item do pedido', () => {
    expect(salesOrderItemStockExternalReference('order-1', 'item-a')).toBe(
      'sales_order:order-1:item:item-a',
    )
    expect(salesOrderItemStockExternalReference('order-1', 'item-a')).toBe(
      salesOrderItemStockExternalReference('order-1', 'item-a'),
    )
    expect(salesOrderItemStockExternalReference('order-1', 'item-a')).not.toBe(
      salesOrderItemStockExternalReference('order-1', 'item-b'),
    )
  })

  it('bate o padrão do unique index no banco', () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000'
    const itemId = '550e8400-e29b-41d4-a716-446655440001'
    const ref = salesOrderItemStockExternalReference(orderId, itemId)
    expect(ref).toMatch(
      /^sales_order:[0-9a-fA-F-]{36}:item:[0-9a-fA-F-]{36}$/,
    )
  })
})
