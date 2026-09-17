import { describe, expect, it } from 'vitest'
import { fiscalIeOrNull, resolveNfeDestinatarioIe } from '@/lib/fiscal/ie'

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

describe('resolveNfeDestinatarioIe', () => {
  it('uses non-contributor for CPF', () => {
    expect(resolveNfeDestinatarioIe({
      documentDigits: '39053344705',
      stateRegistration: '0623079040081',
    })).toEqual({ ok: true, value: { indicadorIE: 9 } })
  })

  it('uses contributor IE for CNPJ', () => {
    expect(resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
      stateRegistration: '062.307.904/0081',
      destUf: 'MG',
    })).toEqual({
      ok: true,
      value: { indicadorIE: 1, inscricaoEstadual: '0623079040081' },
    })
  })

  it('maps isento to non-contributor when dest UF disallows isento (805)', () => {
    expect(resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
      stateRegistrationExempt: true,
      destUf: 'MG',
    })).toEqual({ ok: true, value: { indicadorIE: 9 } })
    expect(resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
      stateRegistrationExempt: true,
      destUf: 'SP',
    })).toEqual({ ok: true, value: { indicadorIE: 9 } })
  })

  it('keeps isento indicator when dest UF still allows it', () => {
    expect(resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
      stateRegistrationExempt: true,
      destUf: 'PR',
    })).toEqual({ ok: true, value: { indicadorIE: 2 } })
  })

  it('defaults exempt CNPJ without UF to non-contributor', () => {
    expect(resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
      stateRegistrationExempt: true,
    })).toEqual({ ok: true, value: { indicadorIE: 9 } })
  })

  it('requires IE for CNPJ that is not exempt', () => {
    const result = resolveNfeDestinatarioIe({
      documentDigits: '11222333000181',
    })
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error).toBe('nfe_customer_ie_required')
  })
})
