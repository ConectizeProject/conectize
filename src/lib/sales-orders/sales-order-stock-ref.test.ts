import { describe, expect, it, vi } from 'vitest'
import {
  applyPaidSalesOrderStockOrRestore,
  consumeSalesOrderStockExitCredit,
  salesOrderItemStockExitCycleExternalReference,
  salesOrderItemStockExternalReference,
} from '@/lib/sales-orders/service'

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

describe('salesOrderItemStockExitCycleExternalReference', () => {
  it('gera ciclo fora do padrão do unique index da saída base', () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000'
    const itemId = '550e8400-e29b-41d4-a716-446655440001'
    const base = salesOrderItemStockExternalReference(orderId, itemId)
    const cycle = salesOrderItemStockExitCycleExternalReference(orderId, itemId, 123)
    expect(cycle).toBe(`${base}:cycle:123`)
    expect(cycle).not.toMatch(
      /^sales_order:[0-9a-fA-F-]{36}:item:[0-9a-fA-F-]{36}$/,
    )
  })
})

describe('consumeSalesOrderStockExitCredit', () => {
  it('pula item quando o líquido já cobre a quantidade (retry de finalize)', () => {
    expect(consumeSalesOrderStockExitCredit(3, 3)).toEqual({
      skip: true,
      nextCredit: 0,
      exitQuantity: 0,
    })
    expect(consumeSalesOrderStockExitCredit(2, 5)).toEqual({
      skip: true,
      nextCredit: 3,
      exitQuantity: 0,
    })
  })

  it('sai só o shortfall quando o crédito é parcial (evita super-baixa)', () => {
    expect(consumeSalesOrderStockExitCredit(3, 0)).toEqual({
      skip: false,
      nextCredit: 0,
      exitQuantity: 3,
    })
    expect(consumeSalesOrderStockExitCredit(5, 2)).toEqual({
      skip: false,
      nextCredit: 0,
      exitQuantity: 3,
    })
  })

  it('permite re-lançar todos os itens após estorno total (crédito 0)', () => {
    let credit = 0
    const itemQtys = [2, 3]
    const decisions = itemQtys.map((qty) => {
      const decision = consumeSalesOrderStockExitCredit(qty, credit)
      credit = decision.nextCredit
      return decision
    })
    expect(decisions.every((d) => d.skip === false)).toBe(true)
    expect(decisions.map((d) => d.exitQuantity)).toEqual([2, 3])
  })

  it('em finalize parcial, cobre o item já baixado e exige saída só do restante', () => {
    // Produto com 2 itens (qty 2 + 3); só o primeiro foi baixado → net/crédito = 2
    let credit = 2
    const first = consumeSalesOrderStockExitCredit(2, credit)
    credit = first.nextCredit
    const second = consumeSalesOrderStockExitCredit(3, credit)
    expect(first).toEqual({ skip: true, nextCredit: 0, exitQuantity: 0 })
    expect(second).toEqual({ skip: false, nextCredit: 0, exitQuantity: 3 })
  })

  it('após orphan + aumento de qty, shortfall + crédito zero mantém net = qty vendida', () => {
    // Saídas órfãs de qty 2; rascunho editado para qty 5
    let credit = 2
    const decision = consumeSalesOrderStockExitCredit(5, credit)
    credit = decision.nextCredit
    expect(decision).toEqual({ skip: false, nextCredit: 0, exitQuantity: 3 })
    expect(credit).toBe(0)
    // net final = 2 (órfão) + 3 (shortfall) = 5
  })

  it('após orphan + redução de qty, crédito sobrando indica excesso a devolver', () => {
    let credit = 5
    const decision = consumeSalesOrderStockExitCredit(2, credit)
    credit = decision.nextCredit
    expect(decision).toEqual({ skip: true, nextCredit: 3, exitQuantity: 0 })
    expect(credit).toBe(3)
  })

  it('ignora qty inválida', () => {
    expect(consumeSalesOrderStockExitCredit(0, 4)).toEqual({
      skip: true,
      nextCredit: 4,
      exitQuantity: 0,
    })
    expect(consumeSalesOrderStockExitCredit(Number.NaN, 4)).toEqual({
      skip: true,
      nextCredit: 4,
      exitQuantity: 0,
    })
  })
})

describe('applyPaidSalesOrderStockOrRestore', () => {
  it('retorna ok quando o apply dos novos itens funciona', async () => {
    const restore = vi.fn(async () => ({ ok: true }))
    const result = await applyPaidSalesOrderStockOrRestore({
      apply: async () => ({ ok: true }),
      restore,
    })
    expect(result).toEqual({ ok: true })
    expect(restore).not.toHaveBeenCalled()
  })

  it('restaura snapshot anterior quando o apply falha (evita net 0 em pedido pago)', async () => {
    const restore = vi.fn(async () => ({ ok: true }))
    const result = await applyPaidSalesOrderStockOrRestore({
      apply: async () => ({ ok: false }),
      restore,
    })
    expect(restore).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: false, error: 'stock_apply_failed' })
  })

  it('propaga stock_restore_failed se a compensação também falhar', async () => {
    const result = await applyPaidSalesOrderStockOrRestore({
      apply: async () => ({ ok: false }),
      restore: async () => ({ ok: false }),
    })
    expect(result).toEqual({ ok: false, error: 'stock_restore_failed' })
  })
})
