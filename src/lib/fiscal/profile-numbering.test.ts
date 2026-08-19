import { describe, expect, it } from 'vitest'
import {
  nfceNumberingForEnvironment,
  nfceNumberingPatch,
  parseAllocatedFiscalNumber,
} from '@/lib/fiscal/numbering'

describe('nfceNumberingForEnvironment', () => {
  it('uses homologation numbering in homologacao', () => {
    const numbering = nfceNumberingForEnvironment({
      fiscal_environment: 'homologacao',
      nfce_series: 9,
      nfce_next_number: 90,
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 10,
      nfce_series_producao: 2,
      nfce_next_number_producao: 20,
    }, 'homologacao')
    expect(numbering).toEqual({ series: 1, nextNumber: 10 })
  })

  it('uses production numbering in producao', () => {
    const numbering = nfceNumberingForEnvironment({
      fiscal_environment: 'producao',
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 10,
      nfce_series_producao: 2,
      nfce_next_number_producao: 20,
    }, 'producao')
    expect(numbering).toEqual({ series: 2, nextNumber: 20 })
  })

  it('falls back to legacy columns of the active environment', () => {
    const homolog = nfceNumberingForEnvironment({
      fiscal_environment: 'homologacao',
      nfce_series: 4,
      nfce_next_number: 40,
    }, 'homologacao')
    const producao = nfceNumberingForEnvironment({
      fiscal_environment: 'producao',
      nfce_series: 5,
      nfce_next_number: 50,
    }, 'producao')
    expect(homolog).toEqual({ series: 4, nextNumber: 40 })
    expect(producao).toEqual({ series: 5, nextNumber: 50 })
  })
})

describe('parseAllocatedFiscalNumber', () => {
  it('reads a table row from the RPC', () => {
    expect(parseAllocatedFiscalNumber([{ series: 1, number: 12 }])).toEqual({ series: 1, number: 12 })
    expect(parseAllocatedFiscalNumber({ series: '2', number: '3' })).toEqual({ series: 2, number: 3 })
    expect(parseAllocatedFiscalNumber([])).toBe(null)
    expect(parseAllocatedFiscalNumber({ series: 0, number: 1 })).toBe(null)
  })
})

describe('nfceNumberingPatch', () => {
  it('increments homologation numbering and mirrors the active columns', () => {
    const result = nfceNumberingPatch({
      fiscal_environment: 'homologacao',
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 10,
    }, 'homologacao')
    expect(result.numbering).toEqual({ series: 1, nextNumber: 10 })
    expect(result.patch).toEqual({
      nfce_series_homologacao: 1,
      nfce_next_number_homologacao: 11,
      nfce_series: 1,
      nfce_next_number: 11,
    })
  })
})
