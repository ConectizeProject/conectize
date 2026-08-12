import { describe, expect, it } from 'vitest'
import {
  resolveOrderDiscountCents,
  resolveOrderPayableCents,
  toOrderDiscountCommissionDbPayload,
} from './order-discount-commission'

describe('order-discount-commission', () => {
  it('resolve desconto fixo e percentual', () => {
    expect(resolveOrderDiscountCents(10_000, 'fixed', 1_500, 0)).toBe(1_500)
    expect(resolveOrderDiscountCents(10_000, 'percent', 0, 10)).toBe(1_000)
    expect(resolveOrderDiscountCents(10_000, 'fixed', 50_000, 0)).toBe(10_000)
  })

  it('resolve total a pagar após desconto', () => {
    expect(resolveOrderPayableCents(10_000, 1_500)).toBe(8_500)
    expect(resolveOrderPayableCents(1_000, 2_000)).toBe(0)
  })

  it('monta payload de banco com comissão desligada', () => {
    const payload = toOrderDiscountCommissionDbPayload(
      {
        discountMode: 'percent',
        discountFixedCents: 0,
        discountPercent: 5,
        commissionEnabled: false,
        commissionUserId: 'abc',
        commissionKind: 'fixed',
        commissionFixedCents: 100,
        commissionPercent: 0,
      },
      10_000,
    )
    expect(payload.discount_cents).toBe(500)
    expect(payload.discount_mode).toBe('percent')
    expect(payload.discount_percent).toBe(5)
    expect(payload.commission_user_id).toBeNull()
    expect(payload.commission_kind).toBeNull()
  })
})
