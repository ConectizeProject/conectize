import { describe, expect, it } from 'vitest'
import {
  resolveDisplayCostCentsFromHints,
  resolveListDisplayCostCents,
  trackLastEntryCost,
  type LastEntryCostHint,
} from '@/lib/products/list-display-cost'

describe('list-display-cost', () => {
  it('usa última entrada quando cost_price é null', () => {
    expect(
      resolveListDisplayCostCents({
        costPriceCents: null,
        costPriceManualEditedAt: null,
        lastEntryUnitValueCents: 15000,
        lastEntryTimeMs: Date.parse('2026-09-09T15:10:42Z'),
      }),
    ).toBe(15000)
  })

  it('trackLastEntryCost mantém a entrada mais recente com valor', () => {
    const map = new Map<string, LastEntryCostHint>()
    trackLastEntryCost(map, 'p1', 'entry', 1000, '2026-01-01T00:00:00Z')
    trackLastEntryCost(map, 'p1', 'entry', 15000, '2026-09-09T00:00:00Z')
    trackLastEntryCost(map, 'p1', 'entry', 0, '2026-10-01T00:00:00Z')
    trackLastEntryCost(map, 'p1', 'exit', 9999, '2026-11-01T00:00:00Z')
    expect(map.get('p1')).toEqual({
      unitValueCents: 15000,
      timeMs: Date.parse('2026-09-09T00:00:00Z'),
    })
  })

  it('resolveDisplayCostCentsFromHints alinha com a regra da listagem', () => {
    expect(
      resolveDisplayCostCentsFromHints({
        costPriceCents: null,
        costPriceManualEditedAt: null,
        lastEntry: { unitValueCents: 15000, timeMs: Date.parse('2026-09-09T00:00:00Z') },
      }),
    ).toBe(15000)
  })
})
