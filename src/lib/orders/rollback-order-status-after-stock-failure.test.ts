import { describe, expect, it, vi } from 'vitest'
import { rollbackOrderStatusAfterStockFailure } from '@/lib/orders/rollback-order-status-after-stock-failure'

describe('rollbackOrderStatusAfterStockFailure', () => {
  it('reverte status e closed_at quando a atualização alterou closed_at', async () => {
    const updates: Array<Record<string, unknown>> = []
    const supabase = {
      from (table: string) {
        expect(table).toBe('service_orders')
        return {
          update (payload: Record<string, unknown>) {
            updates.push(payload)
            return {
              eq (column: string, value: string) {
                expect(column).toBe('id')
                expect(value).toBe('order-1')
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    }

    const result = await rollbackOrderStatusAfterStockFailure(supabase as never, {
      orderId: 'order-1',
      previousStatus: 'aprovado',
      previousClosedAt: null,
      updatePayload: { status: 'cancelada', closed_at: '2026-10-06T12:00:00.000Z' },
      logLabel: 'order-save',
      nextStatus: 'cancelada',
    })

    expect(result).toEqual({ ok: true })
    expect(updates).toEqual([{ status: 'aprovado', closed_at: null }])
  })

  it('não inclui closed_at no rollback se a atualização não o tocou', async () => {
    const updates: Array<Record<string, unknown>> = []
    const supabase = {
      from () {
        return {
          update (payload: Record<string, unknown>) {
            updates.push(payload)
            return {
              eq () {
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    }

    await rollbackOrderStatusAfterStockFailure(supabase as never, {
      orderId: 'order-2',
      previousStatus: 'orcamento',
      previousClosedAt: null,
      updatePayload: { status: 'aprovado' },
      logLabel: 'applyOrderStatusChange',
    })

    expect(updates).toEqual([{ status: 'orcamento' }])
  })

  it('retorna ok:false quando o update de rollback falha', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = {
      from () {
        return {
          update () {
            return {
              eq () {
                return Promise.resolve({ error: { message: 'db down' } })
              },
            }
          },
        }
      },
    }

    const result = await rollbackOrderStatusAfterStockFailure(supabase as never, {
      orderId: 'order-3',
      previousStatus: 'aprovado',
      previousClosedAt: null,
      updatePayload: { status: 'cancelada', closed_at: null },
      logLabel: 'order-save',
      nextStatus: 'cancelada',
    })

    expect(result.ok).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
