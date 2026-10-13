import { describe, expect, it } from 'vitest'
import {
  customerDocumentMatchesSubmitted,
  shouldClaimCustomerFromOsRegistration,
} from './cadastro-cliente-claim'

describe('cadastro-cliente claim from OS link', () => {
  it('exige CPF/CNPJ do cadastro da OS, não de outro cliente da org', () => {
    expect(customerDocumentMatchesSubmitted(
      { cpf: '529.982.247-25', cnpj: null },
      '52998224725',
    )).toBe(true)
    expect(customerDocumentMatchesSubmitted(
      { cpf: '52998224725', cnpj: null },
      '11144477735',
    )).toBe(false)
    expect(customerDocumentMatchesSubmitted(
      { cpf: null, cnpj: '11.222.333/0001-81' },
      '11222333000181',
    )).toBe(true)
  })

  it('só reivindica o customer_id da OS e só se ainda estiver livre', () => {
    expect(shouldClaimCustomerFromOsRegistration({
      orderCustomerId: 'cust-os',
      customer: {
        id: 'cust-os',
        auth_user_id: null,
        cpf: '52998224725',
      },
      submittedDocumentDigits: '52998224725',
    })).toBe(true)

    expect(shouldClaimCustomerFromOsRegistration({
      orderCustomerId: 'cust-os',
      customer: {
        id: 'cust-other',
        auth_user_id: null,
        cpf: '52998224725',
      },
      submittedDocumentDigits: '52998224725',
    })).toBe(false)

    expect(shouldClaimCustomerFromOsRegistration({
      orderCustomerId: 'cust-os',
      customer: {
        id: 'cust-os',
        auth_user_id: 'already-taken',
        cpf: '52998224725',
      },
      submittedDocumentDigits: '52998224725',
    })).toBe(false)

    expect(shouldClaimCustomerFromOsRegistration({
      orderCustomerId: null,
      customer: {
        id: 'cust-orphan',
        auth_user_id: null,
        cpf: '52998224725',
      },
      submittedDocumentDigits: '52998224725',
    })).toBe(false)
  })
})
