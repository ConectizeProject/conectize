import { describe, expect, it } from 'vitest'
import {
  groupProductRowsAsFamilies,
  sliceProductFamilies,
  type IdSortRow,
} from './produtos-flat-list'

function row (partial: Partial<IdSortRow> & Pick<IdSortRow, 'id'>): IdSortRow {
  return {
    catalog_sort_key: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    bling_id: null,
    parent_bling_id: null,
    parent_product_id: null,
    ...partial,
  }
}

describe('groupProductRowsAsFamilies', () => {
  it('coloca o pai acima dos filhos e sobe a família quando o filho é o mais recente', () => {
    const parentA = row({
      id: 'parent-a',
      bling_id: '10',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    const childA = row({
      id: 'child-a',
      parent_bling_id: '10',
      catalog_sort_key: '000000000001.000001',
      updated_at: '2026-08-14T20:00:00.000Z',
    })
    const parentB = row({
      id: 'parent-b',
      bling_id: '20',
      updated_at: '2026-06-01T00:00:00.000Z',
    })

    const families = groupProductRowsAsFamilies([parentB, childA, parentA])
    const flat = families.flat().map((r) => r.id)

    expect(flat).toEqual(['parent-a', 'child-a', 'parent-b'])
  })

  it('agrupa filho por parent_product_id', () => {
    const parent = row({ id: 'p1', updated_at: '2026-01-01T00:00:00.000Z' })
    const child = row({
      id: 'c1',
      parent_product_id: 'p1',
      updated_at: '2026-02-01T00:00:00.000Z',
    })
    const families = groupProductRowsAsFamilies([child, parent])
    expect(families[0].map((r) => r.id)).toEqual(['p1', 'c1'])
  })
})

describe('sliceProductFamilies', () => {
  it('não corta a família no meio da página', () => {
    const families = [
      [row({ id: 'p1' }), row({ id: 'c1', parent_product_id: 'p1' })],
      [row({ id: 'p2' })],
    ]
    const first = sliceProductFamilies(families, 0, 1)
    expect(first.rows.map((r) => r.id)).toEqual(['p1', 'c1'])
    expect(first.totalCount).toBe(3)

    const second = sliceProductFamilies(families, first.rows.length, 1)
    expect(second.rows.map((r) => r.id)).toEqual(['p2'])
  })
})
