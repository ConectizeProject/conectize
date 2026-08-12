import { describe, expect, it } from 'vitest'
import {
  orderFormPaymentMethodsJsonRootSchema,
  orderFormServicesJsonPayloadSchema,
} from '@/lib/orders/order-form-json-schemas'
import {
  parsePaymentMethodsJson,
  parseServicesJson,
} from '@/lib/orders/order-form-parsers'

describe('parsePaymentMethodsJson', () => {
  it('returns empty for invalid JSON', () => {
    expect(parsePaymentMethodsJson('not json')).toEqual([])
  })

  it('returns empty for non-array root', () => {
    expect(parsePaymentMethodsJson(JSON.stringify({ foo: 1 }))).toEqual([])
  })

  it('filters invalid UUID payment_method_id', () => {
    const raw = JSON.stringify([
      { payment_method_id: 'not-a-uuid', installments: 1 },
    ])
    expect(parsePaymentMethodsJson(raw)).toEqual([])
  })

  it('normalizes valid UUID rows', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const raw = JSON.stringify([
      { payment_method_id: id, installments: 3, value_cents: 100 },
    ])
    expect(parsePaymentMethodsJson(raw)).toEqual([
      { payment_method_id: id, installments: 3, value_cents: 100 },
    ])
  })
})

describe('parseServicesJson', () => {
  it('returns empty totals for invalid JSON', () => {
    const r = parseServicesJson('{{{')
    expect(r.items).toEqual([])
    expect(r.totalValueCents).toBe(0)
    expect(r.totalCostCents).toBe(0)
  })

  it('parses items and totals', () => {
    const payload = {
      items: [
        {
          kind: 'service',
          description: 'Troca',
          quantity: 1,
          unitValueCents: 5000,
          unitCostCents: 0,
        },
      ],
      totals: { totalValueCents: 5000, totalCostCents: 0 },
    }
    const r = parseServicesJson(JSON.stringify(payload))
    expect(r.items.length).toBe(1)
    expect(r.items[0].description).toBe('Troca')
    expect(r.items[0].noCost).toBe(false)
    expect(r.totalValueCents).toBe(5000)
  })

  it('persists noCost and forces unit cost to zero', () => {
    const payload = {
      items: [
        {
          kind: 'service',
          description: 'Diagnóstico',
          quantity: 1,
          unitValueCents: 8000,
          unitCostCents: 1500,
          noCost: true,
        },
      ],
    }
    const r = parseServicesJson(JSON.stringify(payload))
    expect(r.items.length).toBe(1)
    expect(r.items[0].noCost).toBe(true)
    expect(r.items[0].unitCostCents).toBe(0)
    expect(r.items[0].costCents).toBe(0)
    expect(r.totalCostCents).toBe(0)
  })
})

describe('order-form-json-schemas', () => {
  it('accepts loose services payload', () => {
    const r = orderFormServicesJsonPayloadSchema.safeParse({
      items: [{ x: 1 }],
      extra: true,
    })
    expect(r.success).toBe(true)
  })

  it('accepts payment methods array of records', () => {
    const r = orderFormPaymentMethodsJsonRootSchema.safeParse([
      { payment_method_id: 'x', a: 1 },
    ])
    expect(r.success).toBe(true)
  })
})
