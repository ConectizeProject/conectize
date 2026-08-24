import { describe, expect, it } from 'vitest'
import {
  blingCompanyIdsMatch,
  hubConnectionCompanyId,
  normalizeBlingCompanyId,
  withBlingCompanyIdMetadata,
} from '@/lib/integrations/bling/hub-company-id'

describe('normalizeBlingCompanyId', () => {
  it('normalizes numeric and string ids', () => {
    expect(normalizeBlingCompanyId(123456)).toBe('123456')
    expect(normalizeBlingCompanyId('0123456')).toBe('123456')
    expect(normalizeBlingCompanyId(' 789 ')).toBe('789')
  })
})

describe('blingCompanyIdsMatch', () => {
  it('matches webhook companyId with stored empresaId', () => {
    expect(blingCompanyIdsMatch('123456', 123456)).toBe(true)
    expect(blingCompanyIdsMatch('123456', '0123456')).toBe(true)
    expect(blingCompanyIdsMatch('123456', '999')).toBe(false)
  })
})

describe('hubConnectionCompanyId', () => {
  it('reads empresaId or companyId from metadata', () => {
    expect(hubConnectionCompanyId({ empresaId: '42' })).toBe('42')
    expect(hubConnectionCompanyId({ companyId: 42 })).toBe('42')
  })
})

describe('withBlingCompanyIdMetadata', () => {
  it('stores both empresaId and companyId aliases', () => {
    const meta = withBlingCompanyIdMetadata({ nome: 'Loja' }, '99')
    expect(meta).toEqual({
      nome: 'Loja',
      empresaId: '99',
      companyId: '99',
    })
  })
})
