import { describe, expect, it } from 'vitest'
import { remainingStockExitQuantity } from '@/lib/orders/stock-by-status'

describe('remainingStockExitQuantity', () => {
  it('retorna zero quando a saída líquida já cobre a quantidade desejada', () => {
    expect(remainingStockExitQuantity(3, 3)).toBe(0)
    expect(remainingStockExitQuantity(2, 5)).toBe(0)
    expect(remainingStockExitQuantity(0, 0)).toBe(0)
  })

  it('retorna só a diferença ao aumentar qty após baixa parcial (ex.: aprovação → finalização)', () => {
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
