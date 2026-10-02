import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyOrderStatusChange } from '@/lib/orders/apply-order-status-change'

const stockTransitionMock = vi.hoisted(() => vi.fn())
const financeSyncMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/orders/stock-by-status', () => ({
  applyOrderStatusStockTransition: (...args: unknown[]) =>
    stockTransitionMock(...args),
}))

vi.mock('@/lib/finance/service-order-financial-sync', () => ({
  syncServiceOrderFinancialTransactions: (...args: unknown[]) =>
    financeSyncMock(...args),
}))

type OrderRow = {
  status: string
  services: unknown
  closed_at: string | null
  device_exit_checks: unknown
  warranty_template_id: string | null
  warranty_text: string | null
  organization_id: string
  display_number: number
  payment_methods: unknown
  updated_at: string
}

function createStatusChangeSupabaseMock (opts: {
  existing: OrderRow
}) {
  const updates: Array<Record<string, unknown>> = []

  const supabase = {
    from (table: string) {
      if (table === 'service_orders') {
        return {
          select () {
            return {
              eq () {
                return {
                  maybeSingle () {
                    return Promise.resolve({ data: opts.existing, error: null })
                  },
                }
              },
            }
          },
          update (payload: Record<string, unknown>) {
            updates.push(payload)
            return {
              eq () {
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      }

      if (table === 'service_order_edit_history') {
        return {
          insert () {
            return Promise.resolve({ error: null })
          },
        }
      }

      throw new Error(`Tabela não mockada: ${table}`)
    },
  }

  return { supabase, updates }
}

describe('applyOrderStatusChange stock sync', () => {
  beforeEach(() => {
    stockTransitionMock.mockReset()
    financeSyncMock.mockReset()
    stockTransitionMock.mockResolvedValue(undefined)
    financeSyncMock.mockResolvedValue(undefined)
  })

  it('reverte o status e retorna stock_sync_failed quando a baixa de estoque falha', async () => {
    stockTransitionMock.mockRejectedValue(new Error('stock db down'))

    const existing: OrderRow = {
      status: 'orcamento',
      services: [
        {
          kind: 'product',
          sourceProductId: '11111111-1111-1111-1111-111111111111',
          quantity: 1,
          unitCostCents: 1000,
        },
      ],
      closed_at: null,
      device_exit_checks: null,
      warranty_template_id: null,
      warranty_text: null,
      organization_id: '22222222-2222-2222-2222-222222222222',
      display_number: 42,
      payment_methods: null,
      updated_at: '2026-10-01T12:00:00.000Z',
    }

    const { supabase, updates } = createStatusChangeSupabaseMock({ existing })

    const result = await applyOrderStatusChange(supabase as never, {
      orderId: '33333333-3333-3333-3333-333333333333',
      nextStatus: 'aprovado',
      editorUserId: '44444444-4444-4444-4444-444444444444',
    })

    expect(result).toEqual({ ok: false, error: 'stock_sync_failed' })
    expect(updates[0]).toMatchObject({ status: 'aprovado' })
    expect(updates[1]).toMatchObject({ status: 'orcamento' })
    expect(financeSyncMock).not.toHaveBeenCalled()
  })

  it('retorna ok quando a sincronização de estoque conclui', async () => {
    const existing: OrderRow = {
      status: 'orcamento',
      services: [],
      closed_at: null,
      device_exit_checks: null,
      warranty_template_id: null,
      warranty_text: null,
      organization_id: '22222222-2222-2222-2222-222222222222',
      display_number: 7,
      payment_methods: null,
      updated_at: '2026-10-01T12:00:00.000Z',
    }

    const { supabase, updates } = createStatusChangeSupabaseMock({ existing })

    const result = await applyOrderStatusChange(supabase as never, {
      orderId: '33333333-3333-3333-3333-333333333333',
      nextStatus: 'aprovado',
      editorUserId: '44444444-4444-4444-4444-444444444444',
    })

    expect(result).toEqual({ ok: true })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ status: 'aprovado' })
    expect(stockTransitionMock).toHaveBeenCalledOnce()
  })
})
