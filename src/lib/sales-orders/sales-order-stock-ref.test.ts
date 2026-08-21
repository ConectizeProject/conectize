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
})
