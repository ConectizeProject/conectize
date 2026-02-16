'use client'

import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function formatPhoneBr(value: string | null | undefined) {
  if (!value) return '-'
  const digits = String(value).replace(/\D/g, '').slice(0, 11)
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (!ddd) return value
  if (rest.length <= 8) {
    const p1 = rest.slice(0, 4)
    const p2 = rest.slice(4, 8)
    return `(${ddd}) ${[p1, p2].filter(Boolean).join('-')}`.trim()
  }
  const p1 = rest.slice(0, 1)
  const p2 = rest.slice(1, 5)
  const p3 = rest.slice(5, 9)
  return `(${ddd}) ${p1} ${[p2, p3].filter(Boolean).join('-')}`.trim()
}

function formatBirthDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('pt-BR')
}

function formatZipCode(value: string | null | undefined) {
  if (!value) return ''
  const digits = onlyDigits(value).slice(0, 8)
  const p1 = digits.slice(0, 5)
  const p2 = digits.slice(5, 8)
  if (!p1) return ''
  return p2 ? `${p1}-${p2}` : p1
}

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

function getDocumentDigits(c: CustomerData) {
  return onlyDigits(String(c.cnpj || c.cpf || ''))
}

function getDocumentMasked(c: CustomerData) {
  return formatCpfCnpj(getDocumentDigits(c))
}

function getDisplayName(c: CustomerData) {
  if (c.is_company) return String(c.company_name || c.trade_name || c.full_name || 'Empresa')
  return String(c.full_name || 'Cliente')
}

function getAddressDisplay(c: CustomerData) {
  if (c.street || c.city || c.zip_code) {
    return [
      c.zip_code ? `CEP ${formatZipCode(c.zip_code)}` : '',
      [c.neighborhood, c.city, c.state].filter(Boolean).join(' / '),
      [c.street, c.street_number, c.street_complement].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join('\n')
  }
  return c.address_full || '-'
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}

type Props = {
  customer: CustomerData
  grid?: boolean
}

export function CustomerDataGrid({ customer, grid = true }: Props) {
  const displayName = getDisplayName(customer)
  const document = getDocumentMasked(customer)
  const address = getAddressDisplay(customer)

  return (
    <div className={grid ? 'grid gap-4 md:grid-cols-2 text-sm' : 'space-y-4 text-sm'}>
      <Field label="Nome" value={displayName} />
      <Field label="Documento" value={document} />
      <Field label="E-mail" value={customer.email || '-'} />
      <Field label="Celular" value={customer.mobile_phone ? formatPhoneBr(customer.mobile_phone) : '-'} />
      <Field
        label="Contato alternativo / Informações"
        value={
          <>
            <span>{customer.contact_phone ? formatPhoneBr(customer.contact_phone) : '-'}</span>
            {customer.contact_notes ? (
              <span className="text-muted-foreground ml-1">• {customer.contact_notes}</span>
            ) : null}
          </>
        }
      />
      <Field label="Nascimento" value={formatBirthDate(customer.birth_date)} />
      <div className={grid ? 'md:col-span-2' : ''}>
        <Field label="Endereço" value={<span className="whitespace-pre-wrap">{address}</span>} />
      </div>
    </div>
  )
}
