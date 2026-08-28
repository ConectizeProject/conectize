import { describe, expect, it } from 'vitest'
import {
  dashboardAparelhosBrutoLiquidoHref,
  dashboardAparelhosVendidosHojeHref,
  dashboardFaturamentoOsHref,
  dashboardOsReceivableHref,
  dashboardVendasHojeHref,
} from '@/lib/dashboard/dashboard-links'

describe('dashboard links', () => {
  it('filters paid sales for today', () => {
    expect(dashboardVendasHojeHref('2026-08-28')).toBe(
      '/portal/vendas?status=paid&from=2026-08-28&to=2026-08-28',
    )
  })

  it('sends admin bruto/liquido to the devices report', () => {
    expect(dashboardAparelhosBrutoLiquidoHref({ dateStr: '2026-08-28', isAdmin: true }))
      .toBe('/portal/relatorios/vendas-aparelhos?from=2026-08-28&to=2026-08-28')
  })

  it('sends staff bruto/liquido to sold devices today', () => {
    expect(dashboardAparelhosBrutoLiquidoHref({ dateStr: '2026-08-28', isAdmin: false }))
      .toBe(dashboardAparelhosVendidosHojeHref('2026-08-28'))
  })

  it('sends staff OS receivables to ordens', () => {
    expect(dashboardOsReceivableHref(false)).toBe('/portal/ordens')
    expect(dashboardOsReceivableHref(true)).toBe('/portal/financeiro?source=os')
  })

  it('filters financeiro OS for today', () => {
    expect(dashboardFaturamentoOsHref({ dateStr: '2026-08-28', isAdmin: true }))
      .toBe('/portal/financeiro?source=os&from=2026-08-28&to=2026-08-28')
    expect(dashboardFaturamentoOsHref({ dateStr: '2026-08-28', isAdmin: false }))
      .toBe('/portal/ordens')
  })
})
