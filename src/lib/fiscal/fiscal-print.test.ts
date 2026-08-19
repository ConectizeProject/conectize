import { describe, expect, it } from 'vitest'
import {
  fiscalIePrintLabel,
  formatFiscalCep,
  formatFiscalEmitenteAddress,
} from '@/lib/fiscal/fiscal-print'

describe('formatFiscalEmitenteAddress', () => {
  it('builds street, number, district, city and CEP', () => {
    expect(formatFiscalEmitenteAddress({
      street: 'Rua Rio de Janeiro',
      number: '100',
      complement: 'Loja 2',
      district: 'Centro',
      city: 'Belo Horizonte',
      state: 'mg',
      zip_code: '30120000',
    })).toBe('Rua Rio de Janeiro, 100, Loja 2, Centro, Belo Horizonte - MG, CEP 30120-000')
  })

  it('returns empty when there is no address', () => {
    expect(formatFiscalEmitenteAddress({})).toBe('')
  })
})

describe('formatFiscalCep', () => {
  it('masks 8 digits', () => {
    expect(formatFiscalCep('30120000')).toBe('30120-000')
  })
})

describe('fiscalIePrintLabel', () => {
  it('prints ISENTO when exempt', () => {
    expect(fiscalIePrintLabel({ state_registration_exempt: true, state_registration: '123' })).toBe('ISENTO')
  })
})
