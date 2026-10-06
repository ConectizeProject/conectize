import { describe, expect, it } from 'vitest'
import { alignItemTaxesToCfop, resolveItemCfop, resolveItemCsosn, resolveSaleItemTaxes, validateCfopCsosnPair } from '@/lib/fiscal/cfop-csosn'

describe('validateCfopCsosnPair', () => {
  it('aceita 5102 com CSOSN 102', () => {
    expect(validateCfopCsosnPair('5102', '102')).toEqual({ ok: true })
  })

  it('aceita 5405 com CSOSN 500', () => {
    expect(validateCfopCsosnPair('5405', '500')).toEqual({ ok: true })
  })

  it('rejeita 5102 com CSOSN 500', () => {
    const result = validateCfopCsosnPair('5102', '500')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('cfop_csosn_mismatch')
    expect(result.message).toContain('5102')
    expect(result.message).toContain('500')
  })

  it('rejeita 5405 com CSOSN 102', () => {
    const result = validateCfopCsosnPair('5405', '102')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('cfop_csosn_mismatch')
  })
})

describe('resolveSaleItemTaxes', () => {
  it('vende sem ST com 5102 e CSOSN 102 no mesmo estado', () => {
    expect(resolveSaleItemTaxes({
      hasSubstitution: false,
      emitUf: 'SP',
      destUf: 'SP',
    })).toEqual({ cfop: '5102', csosn: '102', operationIsSt: false })
  })

  it('vende sem ST com 6102 fora do estado', () => {
    expect(resolveSaleItemTaxes({
      hasSubstitution: false,
      emitUf: 'SP',
      destUf: 'MG',
    }).cfop).toBe('6102')
  })

  it('vende com ST usando 5405 e CSOSN 500 no mesmo estado', () => {
    expect(resolveSaleItemTaxes({
      hasSubstitution: true,
      emitUf: 'SP',
      destUf: 'SP',
    })).toEqual({ cfop: '5405', csosn: '500', operationIsSt: true })
  })

  it('vende com ST usando 6404 fora do estado', () => {
    expect(resolveSaleItemTaxes({
      hasSubstitution: true,
      emitUf: 'SP',
      destUf: 'RJ',
    })).toEqual({ cfop: '6404', csosn: '500', operationIsSt: true })
  })
})

describe('resolveItemCfop', () => {
  it('usa o CFOP do produto e troca 5 por 6 fora do estado', () => {
    expect(resolveItemCfop({
      productCfop: '5405',
      natureCfop: '5102',
      emitUf: 'SP',
      destUf: 'MG',
    })).toBe('6405')
  })

  it('cai no padrão da natureza quando o produto não tem CFOP', () => {
    expect(resolveItemCfop({
      productCfop: null,
      natureCfop: '5102',
      emitUf: 'SP',
      destUf: 'SP',
    })).toBe('5102')
  })
})

describe('alignItemTaxesToCfop', () => {
  it('trata CFOP 5102 como venda sem ST mesmo com CSOSN 500', () => {
    expect(alignItemTaxesToCfop({ cfop: '5102', csosn: '500', icmsCst: '60' })).toEqual({
      cfop: '5102',
      csosn: '102',
      icmsCst: '00',
      operationIsSt: false,
    })
  })

  it('mantém ST quando o CFOP é 5405', () => {
    expect(alignItemTaxesToCfop({ cfop: '5405', csosn: '102', icmsCst: null }).operationIsSt).toBe(true)
    expect(alignItemTaxesToCfop({ cfop: '5405', csosn: '102', icmsCst: null }).csosn).toBe('500')
  })
})

describe('resolveItemCsosn', () => {
  it('usa o CSOSN do produto antes do padrão', () => {
    expect(resolveItemCsosn({
      productCsosn: '500',
      natureCsosn: '102',
    })).toBe('500')
  })
})
