import { onlyDigits } from '@/lib/utils/strings'

/**
 * Cadastro via link de OS: o share_token autoriza a org/OS, não qualquer
 * cliente da org. Só vincula auth_user_id ao customer_id da OS, e só se o
 * CPF/CNPJ informado bater com o cadastro dessa OS.
 */
export function customerDocumentMatchesSubmitted (
  customer: { cpf?: string | null, cnpj?: string | null },
  submittedDocumentDigits: string,
): boolean {
  const submitted = onlyDigits(submittedDocumentDigits)
  if (submitted.length !== 11 && submitted.length !== 14) return false

  const cpf = onlyDigits(String(customer.cpf || ''))
  const cnpj = onlyDigits(String(customer.cnpj || ''))

  if (submitted.length === 11) return Boolean(cpf) && cpf === submitted
  return Boolean(cnpj) && cnpj === submitted
}

export function shouldClaimCustomerFromOsRegistration (input: {
  orderCustomerId: string | null | undefined
  customer: {
    id: string
    auth_user_id?: string | null
    cpf?: string | null
    cnpj?: string | null
  } | null | undefined
  submittedDocumentDigits: string
}): boolean {
  const orderCustomerId = String(input.orderCustomerId || '').trim()
  const customerId = String(input.customer?.id || '').trim()
  if (!orderCustomerId || !customerId || orderCustomerId !== customerId) return false
  if (input.customer?.auth_user_id) return false
  return customerDocumentMatchesSubmitted(input.customer!, input.submittedDocumentDigits)
}
