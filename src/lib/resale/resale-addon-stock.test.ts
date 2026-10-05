import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteStockExitsForResaleAddons,
  insertStockExitsForResaleAddons,
  resaleAddonStockRefPrefix,
} from '@/lib/resale/resale-addon-stock'

type MovementRow = {
  id: string
  organization_id: string
  product_id: string
  type: string
  quantity: number
  source: string
  external_reference: string
}

function createMovementsMock (seed: MovementRow[]) {
  const movements = [...seed]
  let insertFailAt: number | null = null
  let insertCount = 0

  const supabase = {
    from (table: string) {
      if (table === 'products') {
        return {
          select () {
            return {
              eq () {
                return {
                  in (_col: string, ids: string[]) {
                    return Promise.resolve({
                      data: ids.map((id) => ({ id, cost_price_cents: 100 })),
                      error: null,
                    })
                  },
                }
              },
            }
          },
        }
      }

      if (table !== 'product_stock_movements') {
        throw new Error(`Tabela não mockada: ${table}`)
      }

      return {
        insert (payload: Record<string, unknown>) {
          insertCount += 1
          if (insertFailAt != null && insertCount >= insertFailAt) {
            return Promise.resolve({ error: { message: 'insert_failed' } })
          }
          movements.push({
            id: `mov-${movements.length + 1}`,
            organization_id: String(payload.organization_id),
            product_id: String(payload.product_id),
            type: String(payload.type),
            quantity: Number(payload.quantity),
            source: String(payload.source),
            external_reference: String(payload.external_reference),
          })
          return Promise.resolve({ error: null })
        },
        delete () {
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
            then (
              onFulfilled: (value: { error: null }) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) {
              const prefix = String(filters['ilike:external_reference'] || '').replace(/%$/, '')
              for (let i = movements.length - 1; i >= 0; i -= 1) {
                const row = movements[i]
                if (
                  row.organization_id === filters.organization_id
                  && row.source === filters.source
                  && row.external_reference.startsWith(prefix)
                ) {
                  movements.splice(i, 1)
                }
              }
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected)
            },
          }
          return chain
        },
      }
    },
  }

  return {
    supabase: supabase as never,
    movements,
    failInsertAt (n: number) {
      insertFailAt = n
      insertCount = 0
    },
  }
}

describe('resale addon stock rollback', () => {
  const orgId = 'org-1'
  const deviceId = 'device-1'
  const productA = '11111111-1111-1111-1111-111111111111'
  const productB = '22222222-2222-2222-2222-222222222222'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('remove baixas parciais se insert falhar no meio do loop', async () => {
    const mock = createMovementsMock([])
    mock.failInsertAt(2)

    const result = await insertStockExitsForResaleAddons({
      supabase: mock.supabase,
      organizationId: orgId,
      userId: 'user-1',
      deviceId,
      lines: [
        { product_id: productA, quantity: 1 },
        { product_id: productB, quantity: 2 },
      ],
    })

    expect(result.ok).toBe(false)
    expect(mock.movements).toHaveLength(0)
  })

  it('deleteStockExitsForResaleAddons remove só saídas do aparelho', async () => {
    const prefix = resaleAddonStockRefPrefix(deviceId)
    const mock = createMovementsMock([
      {
        id: '1',
        organization_id: orgId,
        product_id: productA,
        type: 'exit',
        quantity: 1,
        source: 'resale_device_sale',
        external_reference: `${prefix}${productA}:aaa`,
      },
      {
        id: '2',
        organization_id: orgId,
        product_id: productB,
        type: 'exit',
        quantity: 1,
        source: 'resale_device_sale',
        external_reference: `resale_device_sale:other-device:${productB}:bbb`,
      },
      {
        id: '3',
        organization_id: orgId,
        product_id: productA,
        type: 'exit',
        quantity: 1,
        source: 'manual',
        external_reference: `${prefix}${productA}:ccc`,
      },
    ])

    const result = await deleteStockExitsForResaleAddons({
      supabase: mock.supabase,
      organizationId: orgId,
      deviceId,
    })

    expect(result.ok).toBe(true)
    expect(mock.movements.map((m) => m.id)).toEqual(['2', '3'])
  })
})
