'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { cn } from '@/lib/utils'

type CustomerHit = {
  id: string
  full_name: string | null
  company_name: string | null
  is_company?: boolean
  cpf?: string | null
  cnpj?: string | null
}

type DeviceModel = {
  id: string
  brand: string | null
  device_type: string | null
  model: string | null
}

type Props = {
  defaultOpen?: boolean
  initialValues: {
    q: string
    cpf: string
    osNumber: string
    status: string
    customerName: string
    customerId: string
    deviceModelId: string
    createdFrom: string
    createdTo: string
    readyFrom: string
    readyTo: string
    noServices: string
    noCost: string
    noPayment: string
  }
  deviceModels: DeviceModel[]
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '').trim()
}

function getCustomerDisplayName(c: CustomerHit): string {
  const name = c.is_company ? (c.company_name || c.full_name || '') : (c.full_name || c.company_name || '')
  const doc = c.is_company ? c.cnpj : c.cpf
  return doc ? `${name} (${formatCpfCnpj(doc)})` : name
}

export function OrdensFilterCollapsible({
  defaultOpen = false,
  initialValues,
  deviceModels,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [customerQuery, setCustomerQuery] = useState(initialValues.customerName || '')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerHit[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(
    initialValues.customerId && initialValues.customerName
      ? { id: initialValues.customerId, full_name: initialValues.customerName, company_name: null, is_company: false }
      : null
  )
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const customerSearchAbortRef = useRef<AbortController | null>(null)
  const customerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasFilters = Boolean(
    initialValues.q ||
    initialValues.cpf ||
    initialValues.osNumber ||
    initialValues.status ||
    initialValues.customerId ||
    initialValues.customerName ||
    initialValues.deviceModelId ||
    initialValues.createdFrom ||
    initialValues.createdTo ||
    initialValues.readyFrom ||
    initialValues.readyTo ||
    initialValues.noServices ||
    initialValues.noCost ||
    initialValues.noPayment
  )

  function buildQuickFilterUrl(override: { noServices?: string; noCost?: string; noPayment?: string }) {
    const params = new URLSearchParams()
    if (initialValues.q) params.set('q', initialValues.q)
    if (initialValues.cpf) params.set('cpf', initialValues.cpf)
    if (initialValues.osNumber) params.set('osNumber', initialValues.osNumber)
    if (initialValues.status) params.set('status', initialValues.status)
    if (initialValues.customerId) params.set('customerId', initialValues.customerId)
    if (initialValues.customerName) params.set('customerName', initialValues.customerName)
    if (initialValues.deviceModelId) params.set('deviceModelId', initialValues.deviceModelId)
    if (initialValues.createdFrom) params.set('createdFrom', initialValues.createdFrom)
    if (initialValues.createdTo) params.set('createdTo', initialValues.createdTo)
    if (initialValues.readyFrom) params.set('readyFrom', initialValues.readyFrom)
    if (initialValues.readyTo) params.set('readyTo', initialValues.readyTo)
    const noServices = override.noServices !== undefined ? override.noServices : initialValues.noServices
    const noCost = override.noCost !== undefined ? override.noCost : initialValues.noCost
    const noPayment = override.noPayment !== undefined ? override.noPayment : initialValues.noPayment
    if (noServices) params.set('noServices', '1')
    if (noCost) params.set('noCost', '1')
    if (noPayment) params.set('noPayment', '1')
    const qs = params.toString()
    return qs ? `/portal/ordens?${qs}` : '/portal/ordens'
  }

  useEffect(() => {
    if (hasFilters && !open) setOpen(true)
  }, [hasFilters, open])

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

  function handleSelectCustomer(c: CustomerHit) {
    setSelectedCustomer(c)
    setCustomerQuery(getCustomerDisplayName(c))
    setCustomerSuggestions([])
  }

  function handleClearCustomer() {
    setSelectedCustomer(null)
    setCustomerQuery('')
    setCustomerSuggestions([])
  }

  const deviceOptions = deviceModels.map((d) => ({
    value: d.id,
    label: [d.brand, d.device_type, d.model].filter(Boolean).join(' • ') || d.id,
  }))

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
          Filtros
          {hasFilters && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Ativos
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 rounded-md border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Filtros rápidos:</span>
            <Link
              href={buildQuickFilterUrl({ noServices: initialValues.noServices ? '' : '1' })}
              className={cn(
                'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/80',
                initialValues.noServices && 'border-primary bg-primary/10 text-primary'
              )}
            >
              Sem serviço a realizar
            </Link>
            <Link
              href={buildQuickFilterUrl({ noCost: initialValues.noCost ? '' : '1' })}
              className={cn(
                'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/80',
                initialValues.noCost && 'border-primary bg-primary/10 text-primary'
              )}
            >
              Sem preço de custo
            </Link>
            <Link
              href={buildQuickFilterUrl({ noPayment: initialValues.noPayment ? '' : '1' })}
              className={cn(
                'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/80',
                initialValues.noPayment && 'border-primary bg-primary/10 text-primary'
              )}
            >
              Sem formas de pagamento
            </Link>
          </div>
          <form action="/portal/ordens" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedCustomer && (
              <input type="hidden" name="customerId" value={selectedCustomer.id} />
            )}
            {initialValues.noServices && <input type="hidden" name="noServices" value="1" />}
            {initialValues.noCost && <input type="hidden" name="noCost" value="1" />}
            {initialValues.noPayment && <input type="hidden" name="noPayment" value="1" />}
            <div className="space-y-2">
              <Label htmlFor="osNumber">Número da OS</Label>
              <Input
                id="osNumber"
                name="osNumber"
                inputMode="numeric"
                placeholder="Ex: 123"
                defaultValue={initialValues.osNumber}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q">Busca (título/descrição)</Label>
              <Input
                id="q"
                name="q"
                placeholder="Ex: troca de tela, iPhone..."
                defaultValue={initialValues.q}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF ou CNPJ</Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="11 ou 14 dígitos"
                defaultValue={initialValues.cpf ? formatCpfCnpj(initialValues.cpf) : ''}
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="customerName">Cliente (nome)</Label>
              <div className="relative">
                <Input
                  id="customerName"
                  name="customerName"
                  placeholder="Buscar por nome..."
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    if (!e.target.value) setSelectedCustomer(null)
                  }}
                  onBlur={() => setTimeout(() => setCustomerSuggestions([]), 150)}
                  autoComplete="off"
                />
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
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Buscando...
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceModelId">Dispositivo</Label>
              <select
                id="deviceModelId"
                name="deviceModelId"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={initialValues.deviceModelId}
              >
                <option value="">Todos</option>
                {deviceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={initialValues.status}
              >
                <option value="">Todos</option>
                <option value="orcamento">Orçamento</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="aguardando_pecas">Aguardando peças</option>
                <option value="em_manutencao">Em manutenção</option>
                <option value="aguardando_retirada">Aguardando retirada</option>
                <option value="finalizada">Finalizada</option>
                <option value="finalizada_sem_conserto">Finalizada sem conserto</option>
                <option value="finalizada_sem_aprovacao">Finalizada sem aprovação</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="createdFrom">Criação (de)</Label>
              <Input
                id="createdFrom"
                name="createdFrom"
                type="date"
                defaultValue={initialValues.createdFrom}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createdTo">Criação (até)</Label>
              <Input
                id="createdTo"
                name="createdTo"
                type="date"
                defaultValue={initialValues.createdTo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readyFrom">Previsão entrega (de)</Label>
              <Input
                id="readyFrom"
                name="readyFrom"
                type="date"
                defaultValue={initialValues.readyFrom}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readyTo">Previsão entrega (até)</Label>
              <Input
                id="readyTo"
                name="readyTo"
                type="date"
                defaultValue={initialValues.readyTo}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3 flex-wrap">
              <Button type="submit">Filtrar</Button>
              <Button variant="outline" asChild>
                <Link href="/portal/ordens">Limpar filtros</Link>
              </Button>
            </div>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
