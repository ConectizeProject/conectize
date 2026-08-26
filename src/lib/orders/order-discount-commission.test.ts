import { describe, expect, it } from 'vitest'
import {
  resolveOrderCommissionCents,
  resolveOrderDiscountCents,
  resolveOrderPartialNetCents,
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

  it('resolve líquido parcial bruto − taxas − custos', () => {
    expect(resolveOrderPartialNetCents(10_000, 300, 2_000)).toBe(7_700)
    expect(resolveOrderPartialNetCents(5_000, 0, 0)).toBe(5_000)
  })

  it('comissão % usa líquido parcial quando informado', () => {
    const order = {
      services_total_cents: 10_000,
      discount_cents: 0,
      commission_user_id: 'u1',
      commission_kind: 'percent',
      commission_percent: 10,
    }
    // legado: 10% de 10000 = 1000
    expect(resolveOrderCommissionCents(order)).toBe(1_000)
    // financeiro: 10% de líquido parcial 7700 = 770
    expect(resolveOrderCommissionCents(order, { partialNetCents: 7_700 })).toBe(770)
  })

  it('comissão fixa ignora base percentual', () => {
    expect(
      resolveOrderCommissionCents(
        {
          commission_user_id: 'u1',
          commission_kind: 'fixed',
          commission_fixed_cents: 2_500,
          commission_percent: 50,
        },
        { partialNetCents: 100 },
      ),
    ).toBe(2_500)
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
