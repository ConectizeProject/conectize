import { describe, expect, it } from 'vitest'
import {
  serviceOrderStockExitExternalReference,
  serviceOrderStockReturnExternalReference,
} from '@/lib/orders/stock-by-status'
import { serviceOrderFinanceSourceKey } from '@/lib/finance/service-order-financial-sync'

describe('service order stock refs', () => {
  const orderId = '550e8400-e29b-41d4-a716-446655440000'
  const productId = '550e8400-e29b-41d4-a716-446655440001'

  it('gera saída e devolução distintas por produto', () => {
    const exitRef = serviceOrderStockExitExternalReference(orderId, productId)
    const returnRef = serviceOrderStockReturnExternalReference(orderId, productId)
    expect(exitRef).toBe(`service_order:${orderId}:item:${productId}`)
    expect(returnRef).toBe(`service_order:${orderId}:item:${productId}:return`)
    expect(exitRef).not.toBe(returnRef)
  })
})

describe('serviceOrderFinanceSourceKey', () => {
  it('é estável por método e índice na OS', () => {
    expect(
      serviceOrderFinanceSourceKey('os-1', 'pm-1', 0),
    ).toBe('service_order:os-1:payment:pm-1:0')
    expect(
      serviceOrderFinanceSourceKey('os-1', 'pm-1', 0),
    ).toBe(serviceOrderFinanceSourceKey('os-1', 'pm-1', 0))
    expect(
      serviceOrderFinanceSourceKey('os-1', 'pm-1', 0),
    ).not.toBe(serviceOrderFinanceSourceKey('os-1', 'pm-1', 1))
  })
})
