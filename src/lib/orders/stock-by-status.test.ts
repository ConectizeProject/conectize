import { describe, expect, it } from 'vitest'
import {
  excessStockExitQuantity,
  remainingStockExitQuantity,
  serviceOrderStockExitExternalReference,
  serviceOrderStockReturnExternalReference,
} from '@/lib/orders/stock-by-status'

describe('remainingStockExitQuantity', () => {
  it('retorna zero quando a saída líquida já cobre a quantidade desejada', () => {
    expect(remainingStockExitQuantity(3, 3)).toBe(0)
    expect(remainingStockExitQuantity(2, 5)).toBe(0)
    expect(remainingStockExitQuantity(0, 0)).toBe(0)
  })

  it('retorna só a diferença ao aumentar qty após baixa parcial', () => {
    // Aprovado com qty 1 (net=1); na finalização qty virou 3 → baixa mais 2, não 3.
    expect(remainingStockExitQuantity(3, 1)).toBe(2)
    expect(remainingStockExitQuantity(5, 0)).toBe(5)
  })

  it('ignora valores inválidos ou negativos', () => {
    expect(remainingStockExitQuantity(Number.NaN, 1)).toBe(0)
    expect(remainingStockExitQuantity(3, Number.NaN)).toBe(3)
    expect(remainingStockExitQuantity(-2, 1)).toBe(0)
    expect(remainingStockExitQuantity(4, -1)).toBe(4)
  })
})

describe('excessStockExitQuantity', () => {
  it('retorna zero quando o líquido não excede o desejado', () => {
    expect(excessStockExitQuantity(3, 3)).toBe(0)
    expect(excessStockExitQuantity(5, 2)).toBe(0)
    expect(excessStockExitQuantity(1, 0)).toBe(0)
  })

  it('devolve a diferença ao reduzir qty após baixa (ex.: aprovado qty 5 → 2)', () => {
    expect(excessStockExitQuantity(2, 5)).toBe(3)
    expect(excessStockExitQuantity(0, 4)).toBe(4)
  })

  it('ignora valores inválidos ou negativos', () => {
    expect(excessStockExitQuantity(Number.NaN, 5)).toBe(5)
    expect(excessStockExitQuantity(2, Number.NaN)).toBe(0)
    expect(excessStockExitQuantity(-1, 3)).toBe(3)
  })
})

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
