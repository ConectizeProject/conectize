import { describe, expect, it } from 'vitest'
import {
  fiscalFciOrNull,
  injectProdNfci,
  maskFci,
  normalizeOptionalFci,
  originRequiresFci,
} from '@/lib/fiscal/fci'

describe('originRequiresFci', () => {
  it('requires FCI only for origins 3, 5 and 8', () => {
    expect(originRequiresFci(3)).toBe(true)
    expect(originRequiresFci('5')).toBe(true)
    expect(originRequiresFci(8)).toBe(true)
    expect(originRequiresFci(0)).toBe(false)
    expect(originRequiresFci(1)).toBe(false)
    expect(originRequiresFci(2)).toBe(false)
    expect(originRequiresFci(4)).toBe(false)
    expect(originRequiresFci(6)).toBe(false)
    expect(originRequiresFci(7)).toBe(false)
  })
})

describe('maskFci', () => {
  it('inserts UUID hyphens while typing', () => {
    expect(maskFci('b01f8a098c214b68')).toBe('B01F8A09-8C21-4B68')
    expect(maskFci('B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F')).toBe(
      'B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F',
    )
  })
})

describe('fiscalFciOrNull', () => {
  it('normalizes a valid UUID', () => {
    expect(fiscalFciOrNull('b01f8a09-8c21-4b68-b0c3-1a2b3c4d5e6f')).toBe(
      'B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F',
    )
    expect(fiscalFciOrNull('B01F8A098C214B68B0C31A2B3C4D5E6F')).toBe(
      'B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F',
    )
  })

  it('rejects incomplete values', () => {
    expect(fiscalFciOrNull('B01F8A09')).toBeNull()
    expect(fiscalFciOrNull('')).toBeNull()
  })
})

describe('normalizeOptionalFci', () => {
  it('treats empty as null and invalid text as invalid', () => {
    expect(normalizeOptionalFci('')).toBeNull()
    expect(normalizeOptionalFci('abc')).toBe('invalid')
  })
})

describe('injectProdNfci', () => {
  it('inserts nFCI after indTot for items that have it', () => {
    const xml = '<prod><indTot>1</indTot></prod><prod><indTot>1</indTot></prod>'
    expect(injectProdNfci(xml, [{ nFCI: 'B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F' }, {}])).toBe(
      '<prod><indTot>1</indTot><nFCI>B01F8A09-8C21-4B68-B0C3-1A2B3C4D5E6F</nFCI></prod><prod><indTot>1</indTot></prod>',
    )
  })
})
