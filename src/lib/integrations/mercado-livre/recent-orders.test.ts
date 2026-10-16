import { describe, expect, it } from 'vitest'
import {
  meliOrderIdsFromSearch,
  meliRecentOrdersWindow,
} from '@/lib/integrations/mercado-livre/recent-orders'

describe('meli recent orders', () => {
  it('abre a janela dos últimos 60 dias', () => {
    const window = meliRecentOrdersWindow(new Date('2026-10-14T23:00:00.000Z'))
    expect(window.from).toBe('2026-08-15T23:00:00.000-00:00')
    expect(window.to).toBe('2026-10-14T23:00:00.000-00:00')
  })

  it('lê os ids da busca sem repetir', () => {
    expect(meliOrderIdsFromSearch({
      results: [{ id: 10 }, { id: '11' }, { id: '' }, null, { id: 10 }],
    })).toEqual(['10', '11'])
  })
})
