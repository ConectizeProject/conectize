import { describe, expect, it } from 'vitest'
import { __private__, syncServiceOrderFinancialTransactions } from './service-order-financial-sync'
import { backfillServiceOrderFinancialTransactionsByOrganization } from './service-order-financial-sync'

function createSupabaseMock ({
  paymentMethods,
}: {
  paymentMethods: Array<{ id: string; conta_id: string | null }>
}) {
  const deletedFilters: Record<string, unknown> = {}
  const insertedRows: Record<string, unknown>[] = []

  const supabase = {
    from (table: string) {
      if (table === 'payment_methods') {
        return {
          select () {
            return {
              eq () {
                return {
                  in () {
                    return Promise.resolve({ data: paymentMethods, error: null })
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'resale_devices') {
        return {
          select () {
            return {
              eq () {
                return {
                  range () {
                    return {
                      order () {
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

      if (table === 'sales_orders') {
        return {
          select () {
            return {
              eq () {
                const chain = {
                  eq () {
                    return chain
                  },
                  range () {
                    return {
                      order () {
                        return Promise.resolve({ data: [], error: null })
                      },
                    }
                  },
                }
                return chain
              },
            }
          },
        }
      }

      if (table === 'sales_order_payments') {
        return {
          select () {
            return {
              eq () {
                return {
                  eq () {
                    return Promise.resolve({ data: [], error: null })
                  },
                  gte () {
                    return {
                      lte () {
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

      if (table === 'financial_transactions') {
        return {
          select () {
            return {
              eq () {
                return {
                  order () {
                    const rows = insertedRows.map((row, index) => ({
                      id: `tx-${index}`,
                      conta_id: String(row.conta_id || ''),
                      amount_cents: Number(row.amount_cents || 0),
                      type: String(row.type || ''),
                      occurred_at: String(row.occurred_at || ''),
                      description: (row.description as string | null) ?? null,
                      created_at: `2026-05-06T12:00:0${index}.000Z`,
                    }))
                    return Promise.resolve({ data: rows, error: null })
                  },
                }
              },
            }
          },
          delete () {
            return {
              in () {
                return Promise.resolve({ error: null })
              },
              eq (field: string, value: unknown) {
                deletedFilters[field] = value
                return {
                  eq (field2: string, value2: unknown) {
                    deletedFilters[field2] = value2
                    return Promise.resolve({ error: null })
                  },
                }
              },
            }
          },
          insert (rows: Record<string, unknown>[]) {
            insertedRows.push(...rows)
            return Promise.resolve({ error: null })
          },
        }
      }

      throw new Error(`Tabela não mockada: ${table}`)
    },
  }

  return {
    supabase,
    deletedFilters,
    insertedRows,
  }
}

describe('service-order-financial-sync private helpers', () => {
  it('parsePaymentMethodsForFinance ignora inválidos e valores zero', () => {
    const parsed = __private__.parsePaymentMethodsForFinance([
      { payment_method_id: 'not-uuid', value_cents: 1500 },
      { payment_method_id: '550e8400-e29b-41d4-a716-446655440000', value_cents: 0 },
      { payment_method_id: '550e8400-e29b-41d4-a716-446655440001', value_cents: 3200 },
    ])

    expect(parsed).toEqual([
      { payment_method_id: '550e8400-e29b-41d4-a716-446655440001', value_cents: 3200 },
    ])
  })

  it('buildOccurredAt considera fuso de São Paulo', () => {
    const occurredAt = __private__.buildOccurredAt({
      id: '550e8400-e29b-41d4-a716-446655440900',
      organization_id: '550e8400-e29b-41d4-a716-446655440901',
      display_number: 1,
      payment_methods: [],
      closed_at: null,
      updated_at: '2026-05-07T02:30:00.000Z',
    })
    expect(occurredAt).toBe('2026-05-06')
  })
})

describe('syncServiceOrderFinancialTransactions', () => {
  const organizationId = '550e8400-e29b-41d4-a716-446655440100'
  const orderId = '550e8400-e29b-41d4-a716-446655440101'

  it('cria transações financeiras ao salvar pagamento válido', async () => {
    const mock = createSupabaseMock({
      paymentMethods: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          conta_id: '550e8400-e29b-41d4-a716-446655440200',
        },
      ],
    })

    await syncServiceOrderFinancialTransactions({
      supabase: mock.supabase as never,
      orderId,
      organizationId,
      orderRow: {
        id: orderId,
        organization_id: organizationId,
        display_number: 123,
        payment_methods: [
          {
            payment_method_id: '550e8400-e29b-41d4-a716-446655440000',
            value_cents: 8900,
          },
        ],
        closed_at: '2026-05-06T12:00:00.000Z',
        updated_at: '2026-05-06T12:00:00.000Z',
      },
    })

    expect(mock.deletedFilters).toEqual({
      service_order_id: orderId,
    })
    expect(mock.insertedRows).toHaveLength(1)
    expect(mock.insertedRows[0]).toMatchObject({
      organization_id: organizationId,
      conta_id: '550e8400-e29b-41d4-a716-446655440200',
      amount_cents: 8900,
      type: 'entrada',
      service_order_id: orderId,
    })
  })

  it('não cria transação quando método não tem conta vinculada', async () => {
    const mock = createSupabaseMock({
      paymentMethods: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          conta_id: null,
        },
      ],
    })

    await syncServiceOrderFinancialTransactions({
      supabase: mock.supabase as never,
      orderId,
      organizationId,
      orderRow: {
        id: orderId,
        organization_id: organizationId,
        display_number: 456,
        payment_methods: [
          {
            payment_method_id: '550e8400-e29b-41d4-a716-446655440010',
            value_cents: 1000,
          },
        ],
        closed_at: null,
        updated_at: '2026-05-06T13:00:00.000Z',
      },
    })

    expect(mock.insertedRows).toHaveLength(0)
  })

  it('remove transações ao limpar métodos de pagamento da OS', async () => {
    const mock = createSupabaseMock({ paymentMethods: [] })

    await syncServiceOrderFinancialTransactions({
      supabase: mock.supabase as never,
      orderId,
      organizationId,
      orderRow: {
        id: orderId,
        organization_id: organizationId,
        display_number: 999,
        payment_methods: [],
        closed_at: null,
        updated_at: '2026-05-06T14:00:00.000Z',
      },
    })

    expect(mock.deletedFilters.service_order_id).toBe(orderId)
    expect(mock.insertedRows).toHaveLength(0)
  })
})

describe('backfillServiceOrderFinancialTransactionsByOrganization', () => {
  it('processa páginas de OS e sincroniza todas', async () => {
    const firstPage = Array.from({ length: 50 }).map((_, idx) => ({
      id: `550e8400-e29b-41d4-a716-44665544${String(300 + idx).padStart(4, '0')}`,
      organization_id: '550e8400-e29b-41d4-a716-446655440100',
      display_number: idx + 1,
      payment_methods: [],
      closed_at: null,
      updated_at: '2026-05-06T12:00:00.000Z',
    }))
    const secondPage = [
      {
        id: '550e8400-e29b-41d4-a716-446655440301',
        organization_id: '550e8400-e29b-41d4-a716-446655440100',
        display_number: 2,
        payment_methods: [],
        closed_at: null,
        updated_at: '2026-05-06T13:00:00.000Z',
      },
    ]
    const ranges: Array<{ from: number; to: number }> = []

    const supabase = {
      from (table: string) {
        if (table === 'service_orders') {
          return {
            select () {
              return {
                eq () {
                  return {
                    range (from: number, to: number) {
                      ranges.push({ from, to })
                      return {
                        order () {
                          if (from === 0) return Promise.resolve({ data: firstPage, error: null })
                          if (from === 50) return Promise.resolve({ data: secondPage, error: null })
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

        if (table === 'resale_devices') {
          return {
            select () {
              return {
                eq () {
                  return {
                    gte () {
                      return {
                        lte () {
                          return Promise.resolve({ data: [], error: null })
                        },
                      }
                    },
                    range () {
                      return {
                        order () {
                          return Promise.resolve({ data: [], error: null })
                        },
                      }
                    },
                    in () {
                      return Promise.resolve({ data: [], error: null })
                    },
                  }
                },
              }
            },
          }
        }

        if (table === 'sales_orders') {
          return {
            select () {
              return {
                eq () {
                  const chain = {
                    eq () {
                      return chain
                    },
                    range () {
                      return {
                        order () {
                          return Promise.resolve({ data: [], error: null })
                        },
                      }
                    },
                    in () {
                      return Promise.resolve({ data: [], error: null })
                    },
                  }
                  return chain
                },
              }
            },
          }
        }

        if (table === 'sales_order_payments') {
          return {
            select () {
              return {
                eq () {
                  return {
                    gte () {
                      return {
                        lte () {
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

        if (table === 'financial_transactions') {
          return {
            delete () {
              return {
                eq () {
                  return {
                    eq () {
                      return Promise.resolve({ error: null })
                    },
                  }
                },
              }
            },
            insert () {
              return Promise.resolve({ error: null })
            },
          }
        }

        if (table === 'payment_methods') {
          return {
            select () {
              return {
                eq () {
                  return {
                    in () {
                      return Promise.resolve({ data: [], error: null })
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

    const result = await backfillServiceOrderFinancialTransactionsByOrganization({
      supabase: supabase as never,
      organizationId: '550e8400-e29b-41d4-a716-446655440100',
      pageSize: 1,
    })

    expect(result.syncedOrders).toBe(51)
    expect(ranges).toEqual([
      { from: 0, to: 49 },
      { from: 50, to: 99 },
    ])
  })
})
