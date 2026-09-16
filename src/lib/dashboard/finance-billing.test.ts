import { describe, expect, it } from 'vitest'
import { classifyDashboardFinanceSource } from '@/lib/dashboard/finance-billing'

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
      description: 'Ajuste manual',
    })).toBe('other')
  })
})
