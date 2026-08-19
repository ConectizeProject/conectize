import { describe, expect, it } from 'vitest'
import { fiscalIeOrNull } from '@/lib/fiscal/ie'

describe('fiscalIeOrNull', () => {
  it('pads MG IE to 13 digits', () => {
    expect(fiscalIeOrNull('062.307.904/0081', 'MG')).toBe('0623079040081')
    expect(fiscalIeOrNull('623079040081', 'mg')).toBe('0623079040081')
  })

  it('keeps already complete SP IE', () => {
    expect(fiscalIeOrNull('110042490114', 'SP')).toBe('110042490114')
  })

  it('returns null when empty', () => {
    expect(fiscalIeOrNull(' ', 'MG')).toBeNull()
  })
})
