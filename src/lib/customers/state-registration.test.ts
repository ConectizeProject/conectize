import { describe, expect, it } from 'vitest'
import { customerStateRegistrationPatch } from '@/lib/customers/state-registration'

describe('customerStateRegistrationPatch', () => {
  it('clears IE for pessoa física', () => {
    expect(customerStateRegistrationPatch({
      isCompany: false,
      stateRegistration: '0623079040081',
      stateRegistrationExempt: true,
    })).toEqual({ state_registration: null, state_registration_exempt: false })
  })

  it('stores isento without IE', () => {
    expect(customerStateRegistrationPatch({
      isCompany: true,
      stateRegistration: '123',
      stateRegistrationExempt: true,
    })).toEqual({ state_registration: null, state_registration_exempt: true })
  })

  it('pads MG IE for CNPJ', () => {
    expect(customerStateRegistrationPatch({
      isCompany: true,
      stateRegistration: '623079040081',
      uf: 'MG',
    })).toEqual({ state_registration: '0623079040081', state_registration_exempt: false })
  })
})
