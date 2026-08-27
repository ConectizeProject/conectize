import { describe, expect, it } from 'vitest'
import { nfceNumberRestorePatch, nfeNumberRestorePatch } from '@/lib/fiscal/numbering'

describe('nfeNumberRestorePatch', () => {
  it('rewinds when the deleted number is the last allocated', () => {
    expect(nfeNumberRestorePatch({ nfe_series: 1, nfe_next_number: 43 }, 1, 42)).toEqual({
      nfe_next_number: 42,
    })
  })

  it('does not rewind a gap in the middle', () => {
    expect(nfeNumberRestorePatch({ nfe_series: 1, nfe_next_number: 45 }, 1, 42)).toBeNull()
  })

  it('does not rewind another series', () => {
    expect(nfeNumberRestorePatch({ nfe_series: 2, nfe_next_number: 43 }, 1, 42)).toBeNull()
  })
})

describe('nfceNumberRestorePatch', () => {
  it('rewinds homologacao counters', () => {
    expect(nfceNumberRestorePatch({
      fiscal_environment: 'homologacao',
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 12,
    }, 'homologacao', 1, 11)).toEqual({
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 11,
      nfce_series: 1,
      nfce_next_number: 11,
    })
  })
})
