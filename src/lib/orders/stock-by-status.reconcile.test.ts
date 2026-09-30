import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'

type MovementRow = {
  id?: string
  product_id: string
  type: 'exit' | 'entry'
  quantity: number
  source: string
  external_reference: string
}

function createStockSupabaseMock (seed: MovementRow[]) {
  const movements = [...seed]
  const inserts: Array<Record<string, unknown>> = []

  const supabase = {
    from (table: string) {
      if (table === 'products') {
        return {
          select () {
            return {
              in (_col: string, ids: string[]) {
                return Promise.resolve({
                  data: ids.map((id) => ({ id, bling_id: null })),
                  error: null,
                })
              },
            }
          },
        }
      }

      if (table !== 'product_stock_movements') {
        throw new Error(`Tabela não mockada: ${table}`)
      }

      return {
        select (_cols: string) {
          const filters: Record<string, unknown> = {}
          const chain = {
            eq (field: string, value: unknown) {
              filters[field] = value
              return chain
            },
            ilike (field: string, pattern: string) {
              filters[`ilike:${field}`] = pattern
              return chain
            },
            maybeSingle () {
              const rows = filterMovements(movements, filters)
              return Promise.resolve({ data: rows[0] ?? null, error: null })
            },
            then (
              onFulfilled: (value: { data: MovementRow[]; error: null }) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) {
              const rows = filterMovements(movements, filters)
              return Promise.resolve({ data: rows, error: null }).then(
                onFulfilled,
                onRejected,
              )
            },
          }
          return chain
        },
        insert (payload: Record<string, unknown>) {
          inserts.push(payload)
          movements.push({
            id: `ins-${inserts.length}`,
            product_id: String(payload.product_id),
            type: payload.type as 'exit' | 'entry',
            quantity: Number(payload.quantity),
            source: String(payload.source),
            external_reference: String(payload.external_reference),
          })
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  return { supabase, inserts, movements }
}

function filterMovements (
  movements: MovementRow[],
  filters: Record<string, unknown>,
) {
  return movements.filter((row) => {
    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith('ilike:')) {
        const field = key.slice('ilike:'.length) as keyof MovementRow
        const pattern = String(value).replace(/%/g, '.*')
        if (!new RegExp(`^${pattern}$`, 'i').test(String(row[field] ?? ''))) {
          return false
        }
        continue
      }
      if (String((row as Record<string, unknown>)[key] ?? '') !== String(value)) {
        return false
      }
    }
    return true
  })
}

const orderId = '550e8400-e29b-41d4-a716-446655440000'
const productId = '550e8400-e29b-41d4-a716-446655440001'

describe('applyOrderStatusStockTransition reconcile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('ao salvar na fase consumidora com qty reduzida, devolve o excesso', async () => {
    const baseExit = `service_order:${orderId}:item:${productId}`
    const mock = createStockSupabaseMock([
      {
        id: 'm1',
        product_id: productId,
        type: 'exit',
        quantity: 5,
        source: 'service_order',
        external_reference: baseExit,
      },
    ])

    await applyOrderStatusStockTransition({
      supabase: mock.supabase as never,
      orderId,
      previousStatus: 'aprovado',
      nextStatus: 'aprovado',
      services: [
        {
          kind: 'product',
          sourceProductId: productId,
          quantity: 2,
          unitCostCents: 1000,
        },
      ],
    })

    expect(mock.inserts).toHaveLength(1)
    expect(mock.inserts[0]).toMatchObject({
      product_id: productId,
      type: 'entry',
      quantity: 3,
      source: 'service_order',
    })
  })

  it('ao aumentar qty na finalização, baixa só a diferença', async () => {
    const baseExit = `service_order:${orderId}:item:${productId}`
    const mock = createStockSupabaseMock([
      {
        id: 'm1',
        product_id: productId,
        type: 'exit',
        quantity: 1,
        source: 'service_order',
        external_reference: baseExit,
      },
    ])

    await applyOrderStatusStockTransition({
      supabase: mock.supabase as never,
      orderId,
      previousStatus: 'aprovado',
      nextStatus: 'finalizada',
      services: [
        {
          kind: 'product',
          sourceProductId: productId,
          quantity: 3,
          unitCostCents: 500,
        },
      ],
    })

    expect(mock.inserts).toHaveLength(1)
    expect(mock.inserts[0]).toMatchObject({
      product_id: productId,
      type: 'exit',
      quantity: 2,
    })
  })

  it('ao remover o produto na fase consumidora, devolve o líquido total', async () => {
    const baseExit = `service_order:${orderId}:item:${productId}`
    const mock = createStockSupabaseMock([
      {
        id: 'm1',
        product_id: productId,
        type: 'exit',
        quantity: 4,
        source: 'service_order',
        external_reference: baseExit,
      },
    ])

    await applyOrderStatusStockTransition({
      supabase: mock.supabase as never,
      orderId,
      previousStatus: 'em_manutencao',
      nextStatus: 'em_manutencao',
      services: [],
    })

    expect(mock.inserts).toHaveLength(1)
    expect(mock.inserts[0]).toMatchObject({
      product_id: productId,
      type: 'entry',
      quantity: 4,
    })
  })
})
