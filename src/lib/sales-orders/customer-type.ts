export type SalesOrderCustomerTypeUi = 'pf' | 'pj'

export type SalesOrderCustomerTypeDb = 'pessoa_fisica' | 'pessoa_juridica'

export function toDbCustomerType (value: SalesOrderCustomerTypeUi | string | null | undefined): SalesOrderCustomerTypeDb {
  if (value === 'pj' || value === 'pessoa_juridica') return 'pessoa_juridica'
  return 'pessoa_fisica'
}

export function fromDbCustomerType (value: string | null | undefined): SalesOrderCustomerTypeUi {
  if (value === 'pj' || value === 'pessoa_juridica') return 'pj'
  return 'pf'
}
