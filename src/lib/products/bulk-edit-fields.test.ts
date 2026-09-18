import { describe, expect, it } from 'vitest'
import {
  bulkEditFieldsForGroup,
  defaultBulkEditFieldKeys,
} from '@/lib/products/bulk-edit-fields'

describe('bulk-edit-fields', () => {
  it('defaults sales to cost and sale price', () => {
    expect(defaultBulkEditFieldKeys('sales')).toEqual(['costPrice', 'salePrice'])
  })

  it('defaults fiscal to all fields', () => {
    expect(defaultBulkEditFieldKeys('fiscal')).toEqual([
      'ncm',
      'cest',
      'fiscalOrigin',
      'fci',
      'fiscalUnit',
    ])
  })

  it('hides compatible models when device model is not allowed', () => {
    const fields = bulkEditFieldsForGroup('custom', { allowDeviceModel: false })
    expect(fields.map((f) => f.id)).toEqual(['description', 'isActive'])
    expect(defaultBulkEditFieldKeys('custom', { allowDeviceModel: false })).toEqual([
      'description',
    ])
  })

  it('includes compatible models by default for products', () => {
    expect(defaultBulkEditFieldKeys('custom', { allowDeviceModel: true })).toEqual([
      'compatibleModelIds',
      'description',
    ])
  })
})
