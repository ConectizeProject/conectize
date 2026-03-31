'use client'

import { LabeledValue } from '@/components/ui/labeled-value'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatCepBr } from '@/lib/utils/format-cep'

export type CustomerData = {
  cpf?: string | null
  cnpj?: string | null
  is_company?: boolean | null
  full_name?: string | null
  company_name?: string | null
  trade_name?: string | null
  email?: string | null
  mobile_phone?: string | null
  contact_phone?: string | null
  contact_notes?: string | null
  address_full?: string | null
  birth_date?: string | null
  zip_code?: string | null
  state?: string | null
  city?: string | null
  neighborhood?: string | null
  street?: string | null
  street_number?: string | null
  street_complement?: string | null
}

function getAddressDisplay(c: CustomerData): string | null {
  if (c.street || c.city || c.zip_code) {
    return [
      c.zip_code ? `CEP ${formatCepBr(c.zip_code)}` : '',
      [c.neighborhood, c.city, c.state].filter(Boolean).join(' / '),
      [c.street, c.street_number, c.street_complement].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join('\n')
  }
  return c.address_full || null
}

type Props = {
  customer: CustomerData
  grid?: boolean
}

export function CustomerDataGrid({ customer, grid = true }: Props) {
  const contactLine = [formatPhoneBr(customer.contact_phone), customer.contact_notes]
    .filter(Boolean)
    .join(' • ') || null
  const address = getAddressDisplay(customer)

  return (
    <div className={grid ? 'grid gap-x-6 gap-y-3 md:grid-cols-3 text-sm' : 'space-y-3 text-sm'}>
      <LabeledValue label="E-mail" value={customer.email?.trim() || null} />
      <LabeledValue label="Contato alternativo / Informações" value={contactLine} />
      <LabeledValue label="Nascimento" value={customer.birth_date ? formatDateBr(customer.birth_date) : null} />
      {address ? (
        <div className={grid ? 'md:col-span-3' : ''}>
          <LabeledValue label="Endereço" value={<span className="whitespace-pre-wrap">{address}</span>} />
        </div>
      ) : null}
    </div>
  )
}
