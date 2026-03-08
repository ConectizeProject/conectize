'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

type CustomerHit = {
  id: string
  full_name: string | null
  company_name: string | null
  is_company?: boolean
  cpf?: string | null
  cnpj?: string | null
}

function getCustomerDisplayName (c: CustomerHit): string {
  const name = c.is_company ? (c.company_name || c.full_name || '') : (c.full_name || c.company_name || '')
  const doc = c.is_company ? c.cnpj : c.cpf
  return doc ? `${name} (${formatCpfCnpj(doc)})` : name
}

export function RelatorioServicosCustomerSelect ({
  initialCustomerId,
  initialCustomerName,
}: {
  initialCustomerId?: string
  initialCustomerName?: string
}) {
  const [customerQuery, setCustomerQuery] = useState(initialCustomerName || '')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerHit[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(
    initialCustomerId && initialCustomerName
      ? { id: initialCustomerId, full_name: initialCustomerName, company_name: null, is_company: false }
      : null
  )
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const customerSearchAbortRef = useRef<AbortController | null>(null)
  const customerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchCustomers = useCallback((term: string) => {
    const t = term.trim()
    if (t.length < 2) {
      setCustomerSuggestions([])
      return
    }
    customerSearchAbortRef.current?.abort()
    const controller = new AbortController()
    customerSearchAbortRef.current = controller
    setIsSearchingCustomer(true)
    portalFetch(`/api/portal/customers/search?name=${encodeURIComponent(t)}`, { signal: controller.signal })
      .then((res) => res?.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.customers)) {
          setCustomerSuggestions(data.customers)
        } else {
          setCustomerSuggestions([])
        }
      })
      .catch(() => setCustomerSuggestions([]))
      .finally(() => setIsSearchingCustomer(false))
  }, [])

  useEffect(() => {
    if (customerSearchDebounceRef.current) clearTimeout(customerSearchDebounceRef.current)
    const t = customerQuery.trim()
    if (t.length < 2) {
      setCustomerSuggestions([])
      return
    }
    customerSearchDebounceRef.current = setTimeout(() => searchCustomers(t), 300)
    return () => {
      if (customerSearchDebounceRef.current) clearTimeout(customerSearchDebounceRef.current)
    }
  }, [customerQuery, searchCustomers])

  function handleSelectCustomer (c: CustomerHit) {
    setSelectedCustomer(c)
    setCustomerQuery(getCustomerDisplayName(c))
    setCustomerSuggestions([])
  }

  function handleClearCustomer () {
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerSuggestions([])
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="relatorio-customer">Cliente</Label>
      <div className="relative">
        <Input
          id="relatorio-customer"
          name="customerName"
          placeholder="Buscar por nome (mín. 2 caracteres)"
          value={customerQuery}
          onChange={(e) => {
            setCustomerQuery(e.target.value)
            if (!e.target.value) setSelectedCustomer(null)
          }}
          onBlur={() => setTimeout(() => setCustomerSuggestions([]), 150)}
          autoComplete="off"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {selectedCustomer && (
          <input type="hidden" name="customerId" value={selectedCustomer.id} />
        )}
        {selectedCustomer && (
          <button
            type="button"
            onClick={handleClearCustomer}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            Limpar
          </button>
        )}
        {customerSuggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover py-1 shadow-md max-h-48 overflow-auto">
            {customerSuggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleSelectCustomer(c)}
                >
                  {getCustomerDisplayName(c)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {isSearchingCustomer && customerQuery.length >= 2 && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Buscando...
          </span>
        )}
      </div>
    </div>
  )
}
