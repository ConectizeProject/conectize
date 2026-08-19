import { describe, expect, it } from 'vitest'
import {
  cestPairingMessage,
  evaluateCestForNcm,
  parseCestLookupHtml,
} from '@/lib/fiscal/cest'

const htmlInTable = `
  <p>Este NCM está na tabela de Substituição Tributária com 1 CEST:</p>
  <p>21.054.00Copiar produtos ↗ Outros telefones para outras redes sem fio</p>
  <p>⚠ As informações fiscais são exibidas para consulta</p>
`

const htmlOutTable = `
  <p>1006.30.21 ver produtos deste NCM</p>
  <p>✓ Este NCM não consta na tabela do Convênio ICMS 142/2018 — em regra, o produto não é sujeito à Substituição Tributária e não possui CEST.</p>
`

describe('parseCestLookupHtml', () => {
  it('detects NCM in the ST table and extracts CEST codes', () => {
    const parsed = parseCestLookupHtml(htmlInTable)
    expect(parsed.status).toBe('in')
    expect(parsed.suggestions.map((item) => item.code)).toEqual(['2105400'])
  })

  it('detects NCM outside the ST table', () => {
    const parsed = parseCestLookupHtml(htmlOutTable)
    expect(parsed.status).toBe('out')
    expect(parsed.suggestions).toEqual([])
  })

  it('returns unknown when the page has no CEST signal', () => {
    expect(parseCestLookupHtml('<html><body>erro</body></html>')).toEqual({
      status: 'unknown',
      suggestions: [],
    })
  })
})

describe('evaluateCestForNcm', () => {
  it('requires a matching CEST when the NCM is in the ST table', () => {
    expect(evaluateCestForNcm({ status: 'in', allowedCests: ['2105400'], cest: null })).toEqual({
      ok: false,
      reason: 'missing',
    })
    expect(evaluateCestForNcm({ status: 'in', allowedCests: ['2105400'], cest: '0100100' })).toEqual({
      ok: false,
      reason: 'mismatch',
    })
    expect(evaluateCestForNcm({ status: 'in', allowedCests: ['21.054.00'], cest: '2105400' }).ok).toBe(true)
  })

  it('rejects CEST when the NCM is outside the ST table', () => {
    expect(evaluateCestForNcm({ status: 'out', allowedCests: [], cest: '2105400' })).toEqual({
      ok: false,
      reason: 'unexpected',
    })
    expect(evaluateCestForNcm({ status: 'out', allowedCests: [], cest: null }).ok).toBe(true)
  })

  it('skips pairing when the lookup is unknown', () => {
    expect(evaluateCestForNcm({ status: 'unknown', allowedCests: [], cest: null }).ok).toBe(true)
    expect(evaluateCestForNcm({ status: 'unknown', allowedCests: [], cest: '2105400' }).ok).toBe(true)
  })
})

describe('cestPairingMessage', () => {
  it('lists allowed CESTs on mismatch', () => {
    expect(cestPairingMessage('mismatch', {
      productName: 'iPhone',
      allowedCests: ['2105400'],
    })).toBe('O CEST de "iPhone" precisa ser 21.054.00 para este NCM.')
  })
})
