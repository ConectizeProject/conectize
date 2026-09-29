import { describe, expect, it } from 'vitest'
import { isStockMovementEditable } from '@/lib/products/stock-movement-editable'

describe('isStockMovementEditable', () => {
  it('permite lançamentos manuais de qualquer tipo', () => {
    expect(isStockMovementEditable('manual', 'entry')).toBe(true)
    expect(isStockMovementEditable('manual', 'exit')).toBe(true)
    expect(isStockMovementEditable('manual', 'loss')).toBe(true)
  })

  it('permite só entradas do Bling', () => {
    expect(isStockMovementEditable('bling', 'entry')).toBe(true)
    expect(isStockMovementEditable('bling', 'exit')).toBe(false)
  })

  it('bloqueia baixas de venda e OS', () => {
    expect(isStockMovementEditable('sales_order', 'exit')).toBe(false)
    expect(isStockMovementEditable('service_order', 'exit')).toBe(false)
    expect(isStockMovementEditable('service_order', 'entry')).toBe(false)
    expect(isStockMovementEditable('system', 'exit')).toBe(false)
  })
})
