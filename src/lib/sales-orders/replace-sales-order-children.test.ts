import { describe, expect, it, vi } from 'vitest'
import {
  replaceSalesOrderItems,
  replaceSalesOrderPayments,
} from '@/lib/sales-orders/service'

vi.mock('@/lib/finance/service-order-financial-sync', () => ({
  syncSalesOrderFinancialTransactions: vi.fn(),
  mapSalesOrdersWithFinancePosted: vi.fn(),
  clearSalesOrderFinancialTransactions: vi.fn(),
}))

vi.mock('@/lib/pdv/service', () => ({
  getOpenCashSession: vi.fn(),
}))

type InsertCall = { table: string, rows: unknown[] }

function createReplaceAuth (opts: {
  itemSnapshot?: Array<Record<string, unknown>>
  paymentSnapshot?: Array<Record<string, unknown>>
  failInsertTables?: Set<string>
}) {
  const inserts: InsertCall[] = []
  const failInsertTables = opts.failInsertTables ?? new Set<string>()
  const restoreAttempts: string[] = []

  function chainEq (terminal: () => Promise<{ data?: unknown, error: unknown }>) {
    const api = {
      eq () {
        return api
      },
      in () {
        return terminal()
      },
      order () {
        return terminal()
      },
      maybeSingle () {
        return terminal()
      },
      then (
        resolve: (value: { data?: unknown, error: unknown }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return terminal().then(resolve, reject)
      },
    }
    return api
  }

  const supabase = {
    from (table: string) {
      return {
        select () {
          return chainEq(async () => {
            if (table === 'products') {
              return { data: [{ id: 'prod-1' }], error: null }
            }
            if (table === 'sales_order_items') {
              return { data: opts.itemSnapshot ?? [], error: null }
            }
            if (table === 'sales_order_payments') {
              return { data: opts.paymentSnapshot ?? [], error: null }
            }
            return { data: [], error: null }
          })
        },
        delete () {
          return chainEq(async () => ({ error: null }))
        },
        insert (rows: unknown[]) {
          inserts.push({ table, rows })
          const shouldFail = failInsertTables.has(table)
          if (shouldFail) {
            // Primeiro insert (novos dados) falha; restore (2º) deve passar.
            failInsertTables.delete(table)
            restoreAttempts.push(table)
            return Promise.resolve({ error: { message: 'insert_failed' } })
          }
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  return {
    auth: {
      organizationId: 'org-1',
      userId: 'user-1',
      supabase: supabase as never,
    },
    inserts,
    restoreAttempts,
  }
}

describe('replaceSalesOrderItems', () => {
  it('restaura itens anteriores quando o insert após delete falha', async () => {
    const previous = [{
      product_id: 'prod-old',
      quantity: 2,
      unit_price_cents: 1000,
      unit_cost_cents: 400,
      discount_cents: 0,
      subtotal_cents: 2000,
    }]
    const { auth, inserts } = createReplaceAuth({
      itemSnapshot: previous,
      failInsertTables: new Set(['sales_order_items']),
    })

    const result = await replaceSalesOrderItems(auth, 'order-1', [{
      product_id: 'prod-1',
      quantity: 1,
      unit_price_cents: 5000,
    }])

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toBe('db_error')
    }

    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.table).toBe('sales_order_items')
    expect(inserts[0]?.rows).toEqual([expect.objectContaining({
      product_id: 'prod-1',
      quantity: 1,
    })])
    expect(inserts[1]?.table).toBe('sales_order_items')
    expect(inserts[1]?.rows).toEqual([expect.objectContaining({
      organization_id: 'org-1',
      sales_order_id: 'order-1',
      product_id: 'prod-old',
      quantity: 2,
      unit_price_cents: 1000,
      subtotal_cents: 2000,
    })])
  })
})

describe('replaceSalesOrderPayments', () => {
  it('restaura pagamentos anteriores quando o insert após delete falha', async () => {
    const previous = [{
      payment_method_id: 'pm-1',
      payment_method_type: 'pix',
      amount_cents: 1500,
      status: 'paid',
      metadata: { installments: 1 },
    }]
    const { auth, inserts } = createReplaceAuth({
      paymentSnapshot: previous,
      failInsertTables: new Set(['sales_order_payments']),
    })

    const result = await replaceSalesOrderPayments(auth, 'order-1', [{
      payment_method_type: 'dinheiro',
      amount_cents: 2000,
    }])

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toBe('db_error')
    }

    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.rows).toEqual([expect.objectContaining({
      payment_method_type: 'dinheiro',
      amount_cents: 2000,
    })])
    expect(inserts[1]?.rows).toEqual([expect.objectContaining({
      organization_id: 'org-1',
      sales_order_id: 'order-1',
      payment_method_id: 'pm-1',
      payment_method_type: 'pix',
      amount_cents: 1500,
      status: 'paid',
    })])
  })
})
