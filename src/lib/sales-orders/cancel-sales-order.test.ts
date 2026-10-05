import { beforeEach, describe, expect, it, vi } from 'vitest'

const syncSalesOrderFinancialTransactions = vi.fn()
const mapSalesOrdersWithFinancePosted = vi.fn()

vi.mock('@/lib/finance/service-order-financial-sync', () => ({
  syncSalesOrderFinancialTransactions: (...args: unknown[]) =>
    syncSalesOrderFinancialTransactions(...args),
  mapSalesOrdersWithFinancePosted: (...args: unknown[]) =>
    mapSalesOrdersWithFinancePosted(...args),
  clearSalesOrderFinancialTransactions: vi.fn(),
}))

vi.mock('@/lib/pdv/service', () => ({
  getOpenCashSession: vi.fn(),
}))

type OrderRow = {
  id: string
  status: string
  order_number: string | null
  bling_pedido_id: string | null
  bling_nfce_id: string | null
}

function createCancelAuth (order: OrderRow) {
  const callOrder: string[] = []
  let currentStatus = order.status

  const supabase = {
    from (table: string) {
      if (table === 'sales_orders') {
        return {
          select () {
            return {
              eq () {
                return {
                  eq () {
                    return {
                      maybeSingle () {
                        return Promise.resolve({
                          data: {
                            id: order.id,
                            status: currentStatus,
                            order_number: order.order_number,
                            bling_pedido_id: order.bling_pedido_id,
                            bling_nfce_id: order.bling_nfce_id,
                          },
                          error: null,
                        })
                      },
                    }
                  },
                }
              },
            }
          },
          update (payload: { status?: string }) {
            return {
              eq () {
                return {
                  eq () {
                    callOrder.push(`status:${payload.status ?? ''}`)
                    if (payload.status) currentStatus = payload.status
                    return Promise.resolve({ error: null })
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'product_stock_movements') {
        // nets vazios → reverse é no-op
        return {
          select () {
            return {
              eq () {
                return {
                  eq () {
                    return {
                      eq () {
                        return Promise.resolve({ data: [], error: null })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }

      throw new Error(`Tabela não mockada: ${table}`)
    },
  }

  return {
    auth: {
      supabase: supabase as never,
      organizationId: 'org-1',
      userId: 'user-1',
    },
    callOrder,
    getStatus: () => currentStatus,
  }
}

describe('cancelSalesOrder', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    syncSalesOrderFinancialTransactions.mockImplementation(async () => {
      // callOrder is per-test; tagged via mockImplementation in each test when needed
    })
    mapSalesOrdersWithFinancePosted.mockResolvedValue(new Set())
  })

  it('não marca canceled se o sync financeiro falhar (permite retry)', async () => {
    const { cancelSalesOrder } = await import('@/lib/sales-orders/service')
    const { auth, callOrder, getStatus } = createCancelAuth({
      id: 'order-1',
      status: 'paid',
      order_number: '1001',
      bling_pedido_id: null,
      bling_nfce_id: null,
    })
    syncSalesOrderFinancialTransactions.mockRejectedValueOnce(
      new Error('delete failed'),
    )

    const result = await cancelSalesOrder(auth, 'order-1', 'cliente desistiu')

    expect(result).toEqual({ ok: false, error: 'finance_sync_failed' })
    expect(syncSalesOrderFinancialTransactions).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual([])
    expect(getStatus()).toBe('paid')
  })

  it('sincroniza financeiro antes de persistir status canceled', async () => {
    const { cancelSalesOrder } = await import('@/lib/sales-orders/service')
    const { auth, callOrder } = createCancelAuth({
      id: 'order-2',
      status: 'paid',
      order_number: '1002',
      bling_pedido_id: null,
      bling_nfce_id: null,
    })
    syncSalesOrderFinancialTransactions.mockImplementation(async () => {
      callOrder.push('finance')
    })

    const result = await cancelSalesOrder(auth, 'order-2', 'estorno')

    expect(result.ok).toBe(true)
    expect(callOrder).toEqual(['finance', 'status:canceled'])
  })

  it('recupera financeiro órfão em pedido já canceled', async () => {
    const { cancelSalesOrder } = await import('@/lib/sales-orders/service')
    const { auth, callOrder } = createCancelAuth({
      id: 'order-3',
      status: 'canceled',
      order_number: '1003',
      bling_pedido_id: null,
      bling_nfce_id: null,
    })
    mapSalesOrdersWithFinancePosted.mockResolvedValueOnce(new Set(['order-3']))

    const result = await cancelSalesOrder(auth, 'order-3', null)

    expect(result).toEqual({
      ok: true,
      blingWarning: null,
      hadStockReversal: false,
    })
    expect(syncSalesOrderFinancialTransactions).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual([])
  })

  it('mantém already_canceled quando não há financeiro órfão', async () => {
    const { cancelSalesOrder } = await import('@/lib/sales-orders/service')
    const { auth } = createCancelAuth({
      id: 'order-4',
      status: 'canceled',
      order_number: '1004',
      bling_pedido_id: null,
      bling_nfce_id: null,
    })
    mapSalesOrdersWithFinancePosted.mockResolvedValueOnce(new Set())

    const result = await cancelSalesOrder(auth, 'order-4', null)

    expect(result).toEqual({ ok: false, error: 'already_canceled' })
    expect(syncSalesOrderFinancialTransactions).not.toHaveBeenCalled()
  })
})
