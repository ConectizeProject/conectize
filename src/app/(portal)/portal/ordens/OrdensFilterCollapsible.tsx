'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
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

type InitialValues = {
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

type Props = {
  initialValues: InitialValues
  deviceModels: DeviceModel[]
}

function getCustomerDisplayName (c: CustomerHit): string {
  const name = c.is_company ? (c.company_name || c.full_name || '') : (c.full_name || c.company_name || '')
  const doc = c.is_company ? c.cnpj : c.cpf
  return doc ? `${name} (${formatCpfCnpj(doc)})` : name
}

function hasOrdensExtraFilters (iv: InitialValues): boolean {
  return Boolean(
    iv.osNumber ||
    iv.cpf ||
    iv.customerId ||
    iv.customerName ||
    iv.deviceModelId ||
    iv.status ||
    iv.createdFrom ||
    iv.createdTo ||
    iv.readyFrom ||
    iv.readyTo ||
    iv.noServices ||
    iv.noCost ||
    iv.noPayment
  )
}

export function OrdensFilterCollapsible ({
  initialValues,
  deviceModels,
}: Props) {
  const urlExtra = hasOrdensExtraFilters(initialValues)
  const [extraOpen, setExtraOpen] = useState(urlExtra)

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

  const hasQuickActive =
    Boolean(initialValues.noServices) ||
    Boolean(initialValues.noCost) ||
    Boolean(initialValues.noPayment)

  const showDetailFiltersIndicator = urlExtra || hasQuickActive

  function buildQuickFilterUrl (override: { noServices?: string; noCost?: string; noPayment?: string }) {
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
      queueMicrotask(() => {
        setCustomerSuggestions([])
      })
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

  const deviceOptions = useMemo(
    () =>
      deviceModels
        .map((d) => ({
          value: d.id,
          label: [d.brand, d.device_type, d.model].filter(Boolean).join(' ') || d.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [deviceModels],
  )

  const initialDeviceLabel = useMemo(() => {
    if (!initialValues.deviceModelId) return ''
    const d = deviceModels.find((x) => x.id === initialValues.deviceModelId)
    if (!d) return ''
    return [d.brand, d.device_type, d.model].filter(Boolean).join(' ') || d.id
  }, [deviceModels, initialValues.deviceModelId])

  const [deviceQuery, setDeviceQuery] = useState(initialDeviceLabel)
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialValues.deviceModelId || '')
  const [deviceSuggestions, setDeviceSuggestions] = useState<typeof deviceOptions>([])
  const deviceBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedDeviceId) {
      queueMicrotask(() => {
        setDeviceSuggestions([])
      })
      return
    }
    const q = deviceQuery.trim().toLowerCase()
    if (q.length < 2) {
      queueMicrotask(() => {
        setDeviceSuggestions([])
      })
      return
    }
    const next = deviceOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50)
    queueMicrotask(() => {
      setDeviceSuggestions(next)
    })
  }, [deviceQuery, deviceOptions, selectedDeviceId])

  function handleSelectDevice (opt: { value: string; label: string }) {
    setSelectedDeviceId(opt.value)
    setDeviceQuery(opt.label)
    setDeviceSuggestions([])
  }

  function handleClearDevice () {
    setSelectedDeviceId('')
    setDeviceQuery('')
    setDeviceSuggestions([])
  }

  return (
    <div className="rounded-md border bg-card p-3">
      <form action="/portal/ordens" method="get">
        {initialValues.noServices ? <input type="hidden" name="noServices" value="1" /> : null}
        {initialValues.noCost ? <input type="hidden" name="noCost" value="1" /> : null}
        {initialValues.noPayment ? <input type="hidden" name="noPayment" value="1" /> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <Input
              id="ordens-q"
              name="q"
              placeholder="Texto: mín. 2 caracteres · OS: só números · documento ou cliente…"
              defaultValue={initialValues.q}
              aria-label="Busca ampla"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button type="submit" className="h-10 touch-manipulation px-4">
              Filtrar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative h-10 w-10 shrink-0 touch-manipulation"
              onClick={() => setExtraOpen((v) => !v)}
              aria-expanded={extraOpen}
              aria-controls="ordens-extra-filters"
              aria-label={
                extraOpen
                  ? 'Ocultar filtros detalhados'
                  : 'Abrir filtros detalhados'
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showDetailFiltersIndicator ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </Button>
          </div>
        </div>

        <Collapsible
          open={extraOpen}
          onOpenChange={setExtraOpen}
          className="data-[state=open]:mt-3"
        >
          <CollapsibleContent
            id="ordens-extra-filters"
            forceMount
            className="overflow-hidden data-[state=closed]:hidden"
          >
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium text-muted-foreground">Filtros rápidos:</span>
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {selectedCustomer && (
                  <input type="hidden" name="customerId" value={selectedCustomer.id} />
                )}
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
                  <Label htmlFor="cpf">CPF ou CNPJ</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    inputMode="numeric"
                    placeholder="11 ou 14 dígitos"
                    defaultValue={initialValues.cpf ? formatCpfCnpj(initialValues.cpf) : ''}
                  />
                </div>
                <div className="relative space-y-2">
                  <Label htmlFor="customerName">Cliente (nome)</Label>
                  <div className="relative">
                    <Input
                      id="customerName"
                      name="customerName"
                      placeholder="Buscar por nome…"
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                    {customerSuggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
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
                        Buscando…
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative space-y-2">
                  {selectedDeviceId ? <input type="hidden" name="deviceModelId" value={selectedDeviceId} /> : null}
                  <Label htmlFor="deviceModelSearch">Dispositivo</Label>
                  <div className="relative">
                    <Input
                      id="deviceModelSearch"
                      placeholder="Marca, tipo ou modelo (mín. 2 caracteres)…"
                      value={deviceQuery}
                      onChange={(e) => {
                        setDeviceQuery(e.target.value)
                        setSelectedDeviceId('')
                      }}
                      onBlur={() => {
                        deviceBlurTimeoutRef.current = setTimeout(() => setDeviceSuggestions([]), 150)
                      }}
                      onFocus={() => {
                        if (deviceBlurTimeoutRef.current) {
                          clearTimeout(deviceBlurTimeoutRef.current)
                          deviceBlurTimeoutRef.current = null
                        }
                      }}
                      autoComplete="off"
                    />
                    {selectedDeviceId && (
                      <button
                        type="button"
                        onClick={handleClearDevice}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                    {deviceSuggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
                        {deviceSuggestions.map((opt) => (
                          <li key={opt.value}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectDevice(opt)}
                            >
                              {opt.label}
                            </button>
                          </li>
                        ))}
                        {deviceSuggestions.length === 50 ? (
                          <li className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                            Lista limitada a 50 itens — refine a busca se não encontrar o modelo.
                          </li>
                        ) : null}
                      </ul>
                    )}
                    {!selectedDeviceId && deviceQuery.trim().length > 0 && deviceQuery.trim().length < 2 && (
                      <p className="mt-1 text-xs text-muted-foreground">Digite ao menos 2 caracteres para buscar.</p>
                    )}
                    {!selectedDeviceId && deviceQuery.trim().length >= 2 && deviceSuggestions.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Nenhum dispositivo encontrado.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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

                <div className="sm:col-span-2 lg:col-span-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/portal/ordens">Limpar filtros</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>
    </div>
  )
}
