import { describe, expect, it } from 'vitest'
import {
  classifyDashboardFinanceSource,
  sumOrderPaymentMethodsCents,
} from '@/lib/dashboard/finance-billing'

describe('classifyDashboardFinanceSource', () => {
  it('classifica OS, PDV e seminovo', () => {
    expect(classifyDashboardFinanceSource({
      service_order_id: '550e8400-e29b-41d4-a716-446655440001',
    })).toBe('os')
    expect(classifyDashboardFinanceSource({
      sales_order_id: '550e8400-e29b-41d4-a716-446655440002',
    })).toBe('pdv')
    expect(classifyDashboardFinanceSource({
      resale_device_id: '550e8400-e29b-41d4-a716-446655440003',
    })).toBe('seminovo')
    expect(classifyDashboardFinanceSource({
      description: 'PDV:550e8400-e29b-41d4-a716-446655440004:Venda',
    })).toBe('pdv')
    expect(classifyDashboardFinanceSource({
      description: 'OS #709 - Dinheiro',
    })).toBe('os')
    expect(classifyDashboardFinanceSource({
      description: 'Ajuste manual',
    })).toBe('other')
  })
})

describe('sumOrderPaymentMethodsCents', () => {
  it('soma value_cents válidos', () => {
    expect(sumOrderPaymentMethodsCents([
      { payment_method_id: 'a', value_cents: 1000 },
      { payment_method_id: 'b', value_cents: 29000 },
      { payment_method_id: 'c', value_cents: -5 },
    ])).toBe(30000)
    expect(sumOrderPaymentMethodsCents(null)).toBe(0)
  })
})
