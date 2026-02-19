'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { CustomerDataGrid } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

function getCustomerDisplayName(c: { is_company?: boolean; company_name?: string; full_name?: string }) {
  if (c.is_company) return String(c.company_name || c.full_name || 'Empresa')
  return String(c.full_name || 'Cliente')
}

function getCustomerDocumentMasked(c: { cpf?: string | null; cnpj?: string | null }) {
  return formatCpfCnpj(onlyDigits(String(c.cnpj || c.cpf || '')))
}

type OrderCustomer = {
  id?: string
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
  referral_source?: string | null
  referral_source_other?: string | null
}

type Props = {
  customer: OrderCustomer
}

export function OrderCustomerCard({ customer }: Props) {
  const router = useRouter()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const asCustomerHit: CustomerHit = {
    id: customer.id || '',
    cpf: customer.cpf ?? null,
    cnpj: customer.cnpj ?? null,
    is_company: customer.is_company ?? false,
    full_name: customer.full_name ?? null,
    company_name: customer.company_name ?? null,
    trade_name: customer.trade_name ?? null,
    email: customer.email ?? null,
    mobile_phone: customer.mobile_phone ?? null,
    contact_phone: customer.contact_phone ?? null,
    contact_notes: customer.contact_notes ?? null,
    address_full: customer.address_full ?? null,
    birth_date: customer.birth_date ?? null,
    zip_code: customer.zip_code ?? null,
    state: customer.state ?? null,
    city: customer.city ?? null,
    neighborhood: customer.neighborhood ?? null,
    street: customer.street ?? null,
    street_number: customer.street_number ?? null,
    street_complement: customer.street_complement ?? null,
    referral_source: customer.referral_source ?? null,
    referral_source_other: customer.referral_source_other ?? null,
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Dados do cliente</CardTitle>
              <CardDescription>
                {getCustomerDisplayName(customer)} • {getCustomerDocumentMasked(customer)}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              aria-label="Editar cliente"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CustomerDataGrid customer={customer} />
        </CardContent>
      </Card>

      <EditCustomerDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        customer={asCustomerHit}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
