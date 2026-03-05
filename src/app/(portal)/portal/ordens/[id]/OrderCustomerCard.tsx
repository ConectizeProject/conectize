'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, ChevronDown, ChevronUp, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { CustomerDataGrid, CustomerOrderHistoryModal } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { portalFetch } from '@/lib/portal/portal-fetch'

function getCustomerDisplayName(c: { is_company?: boolean; company_name?: string; full_name?: string }) {
  if (c.is_company) return String(c.company_name || c.full_name || 'Empresa')
  return String(c.full_name || 'Cliente')
}

function getCustomerDocumentMasked(c: { cpf?: string | null; cnpj?: string | null }) {
  return formatCpfCnpj(onlyDigits(String(c.cnpj || c.cpf || '')).slice(0, 14))
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isDataOpen, setIsDataOpen] = useState(false)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const customerId = customer.id ?? ''

  useEffect(() => {
    if (!customerId) {
      setOrderCount(null)
      return
    }
    let cancelled = false
    portalFetch(`/api/portal/ordens?customerId=${encodeURIComponent(customerId)}&countOnly=1`)
      .then((res) => res?.json())
      .then((data) => {
        if (cancelled) return
        if (data?.ok && typeof data.count === 'number') {
          setOrderCount(data.count)
        } else {
          setOrderCount(0)
        }
      })
      .catch(() => {
        if (!cancelled) setOrderCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  const showHistoryButton = customerId && orderCount !== null && orderCount > 1

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
      <Collapsible open={isDataOpen} onOpenChange={setIsDataOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardDescription>
                  {getCustomerDisplayName(customer)} • {getCustomerDocumentMasked(customer)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {showHistoryButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHistoryOpen(true)}
                    aria-label="Ver histórico de ordens do cliente"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  aria-label="Editar cliente"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={isDataOpen ? 'Recolher dados do cliente' : 'Exibir dados do cliente'}
                  >
                    {isDataOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <CustomerDataGrid customer={customer} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <EditCustomerDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        customer={asCustomerHit}
        onSaved={() => router.refresh()}
      />

      {showHistoryButton ? (
        <CustomerOrderHistoryModal
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          customerId={customerId}
          isCreationPage={false}
        />
      ) : null}
    </>
  )
}
