import { describe, expect, it } from 'vitest'
import { validateCfopCsosnPair } from '@/lib/fiscal/cfop-csosn'

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
