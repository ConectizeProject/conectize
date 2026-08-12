'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftRight, Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  formatMoneyInput,
  maskedFromCents,
  moneyToCentsFromMasked,
} from '@/lib/utils/money'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { toast } from '@/hooks/use-toast'
import { SalesOrderAfterSaleActions } from '@/app/(portal)/portal/vendas/SalesOrderAfterSaleActions'
import { fromDbCustomerType } from '@/lib/sales-orders/customer-type'
import {
  CreateCustomerDialog,
  EditCustomerDialog,
  type CustomerHit,
} from '@/components/customers'
import {
  getCustomerDocumentDigits,
  useNovaOrdemCustomerSearch,
} from '@/app/(portal)/portal/ordens/nova/use-nova-ordem-customer-search'
import {
  OrderPaymentMethodsCard,
  type PaymentMethodEntry,
} from '@/components/orders'
import {
  emptyPaymentEntry,
  paymentEntriesToSalesPayload,
  paymentsTotalCents,
} from '@/lib/payments/payment-method-entries'
import { cn } from '@/lib/utils'

type OrderDetail = {
  id: string
  order_number: number
  status: string
  customer_name: string | null
  customer_type: string | null
  customer_document: string | null
  subtotal_cents: number
  discount_total_cents: number
  surcharge_cents?: number
  total_cents: number
  paid_amount_cents: number
  change_cents: number
  bling_pedido_id?: string | null
  bling_nfce_id?: string | null
  created_at: string
  updated_at: string
}

type OrderItem = {
  id: string
  product_id: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents?: number
  discount_cents: number
  subtotal_cents: number
  products?: { name?: string, sku?: string | null } | null
}

type EditableItem = {
  key: string
  product_id: string
  name: string
  sku: string | null
  quantity: number
  unit_price_masked: string
  discount_masked: string
  unit_cost_cents: number
}

function getCustomerDisplayName (c: CustomerHit) {
  if (c.is_company) return String(c.company_name || c.trade_name || c.full_name || 'Empresa')
  return String(c.full_name || 'Cliente')
}

function customerHitFromOrder (order: OrderDetail): CustomerHit | null {
  const name = String(order.customer_name || '').trim()
  const doc = onlyDigits(String(order.customer_document || ''))
  if (!name && !doc) return null
  if (name.toLowerCase() === 'consumidor final' && !doc) return null

  const isCompany = fromDbCustomerType(order.customer_type) === 'pj'
  return {
    id: `local:${order.id}`,
    full_name: isCompany ? null : name || null,
    company_name: isCompany ? name || null : null,
    is_company: isCompany,
    cpf: isCompany ? null : (doc || null),
    cnpj: isCompany ? (doc || null) : null,
  }
}

function applyCustomerFields (customer: CustomerHit | null) {
  if (!customer) {
    return {
      customerName: 'Consumidor Final',
      customerType: 'pf' as const,
      customerDocument: '',
    }
  }
  const name = getCustomerDisplayName(customer).trim() || 'Consumidor Final'
  const doc = getCustomerDocumentDigits(customer)
  return {
    customerName: name,
    customerType: customer.is_company ? 'pj' as const : 'pf' as const,
    customerDocument: doc,
  }
}

type OrderPayment = {
  id: string
  payment_method_id?: string | null
  payment_method_type: string
  amount_cents: number
  status: string
  metadata?: { installments?: number } | null
}

type PaymentMethodCatalogItem = {
  id: string
  description: string
  type: string
}

function statusLabel (status: string) {
  if (status === 'in_progress') return 'Em andamento'
  if (status === 'paid') return 'Pago'
  if (status === 'canceled') return 'Cancelado'
  return status
}

function paymentsToEntries (payments: OrderPayment[]): PaymentMethodEntry[] {
  if (payments.length === 0) return [emptyPaymentEntry()]
  return payments.map((payment) => ({
    payment_method_id: String(payment.payment_method_id || ''),
    installments: Math.max(1, Number(payment.metadata?.installments) || 1),
    value_cents: Math.max(0, Number(payment.amount_cents) || 0),
  }))
}

function itemSubtotalCents (item: EditableItem) {
  const unit = moneyToCentsFromMasked(item.unit_price_masked) ?? 0
  const discount = moneyToCentsFromMasked(item.discount_masked) ?? 0
  return Math.max(0, (unit * Math.max(1, item.quantity)) - discount)
}

function toEditableItems (items: OrderItem[]): EditableItem[] {
  return items.map((item) => ({
    key: item.id,
    product_id: item.product_id,
    name: item.products?.name || 'Produto',
    sku: item.products?.sku ?? null,
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price_masked: maskedFromCents(item.unit_price_cents),
    discount_masked: maskedFromCents(item.discount_cents),
    unit_cost_cents: Math.max(0, Number(item.unit_cost_cents) || 0),
  }))
}

export default function PedidoVendaDetailPage () {
  const params = useParams()
  const router = useRouter()
  const orderId = String(params.id || '')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [items, setItems] = useState<EditableItem[]>([])
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [paymentEntries, setPaymentEntries] = useState<PaymentMethodEntry[]>([
    emptyPaymentEntry(),
  ])
  const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState<PaymentMethodCatalogItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [customerType, setCustomerType] = useState<'pf' | 'pj'>('pf')
  const [customerDocument, setCustomerDocument] = useState('')
  const [discountMasked, setDiscountMasked] = useState('')
  const [surchargeMasked, setSurchargeMasked] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false)

  const {
    customerSearchInput,
    setCustomerSearchInput,
    documentDigits,
    isDocumentMode,
    isNameMode,
    isSearchingDocument,
    documentSearchError,
    hasFetched,
    customersFiltered,
    isCpfPopoverOpen,
    setIsCpfPopoverOpen,
  } = useNovaOrdemCustomerSearch({ selectedCustomer })

  const isEditable = order?.status === 'in_progress' || order?.status === 'paid'

  const previewSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + itemSubtotalCents(item), 0),
    [items],
  )
  const previewDiscount = moneyToCentsFromMasked(discountMasked) ?? 0
  const previewSurcharge = moneyToCentsFromMasked(surchargeMasked) ?? 0
  const previewTotal = Math.max(0, previewSubtotal - previewDiscount + previewSurcharge)
  const paymentsTotal = useMemo(
    () => paymentsTotalCents(paymentEntries),
    [paymentEntries],
  )

  function selectCustomer (customer: CustomerHit | null) {
    setSelectedCustomer(customer)
    const fields = applyCustomerFields(customer)
    setCustomerName(fields.customerName)
    setCustomerType(fields.customerType)
    setCustomerDocument(fields.customerDocument)
    setIsCpfPopoverOpen(false)
  }

  useEffect(() => {
    async function loadPaymentMethods () {
      const res = await portalFetch('/api/portal/payment-methods')
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.paymentMethods)) {
        setPaymentMethodsCatalog(data.paymentMethods as PaymentMethodCatalogItem[])
      }
    }
    void loadPaymentMethods()
  }, [])

  useEffect(() => {
    async function load () {
      const res = await portalFetch(`/api/portal/sales-orders/${orderId}`)
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({ title: 'Pedido não encontrado', variant: 'destructive' })
        return
      }
      const nextOrder = data.order as OrderDetail
      const nextPayments = (data.payments ?? []) as OrderPayment[]
      setOrder(nextOrder)
      setItems(toEditableItems((data.items ?? []) as OrderItem[]))
      setPayments(nextPayments)
      setPaymentEntries(paymentsToEntries(nextPayments))
      setDiscountMasked(maskedFromCents(nextOrder.discount_total_cents))
      setSurchargeMasked(maskedFromCents(nextOrder.surcharge_cents ?? 0))

      const doc = onlyDigits(String(nextOrder.customer_document || ''))
      let matched: CustomerHit | null = null
      if (doc.length >= 5) {
        const searchRes = await portalFetch(
          `/api/portal/customers/search?documentPrefix=${encodeURIComponent(doc.slice(0, 5))}`,
        )
        const searchData = await searchRes?.json().catch(() => null)
        if (searchData?.ok && Array.isArray(searchData.customers)) {
          matched = (searchData.customers as CustomerHit[]).find((customer) => (
            getCustomerDocumentDigits(customer) === doc
          )) ?? null
        }
      }

      const customer = matched ?? customerHitFromOrder(nextOrder)
      setSelectedCustomer(customer)
      const fields = applyCustomerFields(customer)
      setCustomerName(fields.customerName)
      setCustomerType(fields.customerType)
      setCustomerDocument(fields.customerDocument)
      if (customer && !matched) {
        setCustomerName(nextOrder.customer_name || fields.customerName)
        setCustomerType(fromDbCustomerType(nextOrder.customer_type))
        setCustomerDocument(doc)
      }
    }
    if (orderId) void load()
  }, [orderId])

  function updateItem (key: string, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item) => (
      item.key === key ? { ...item, ...patch } : item
    )))
  }

  function removeItem (key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  async function saveOrder () {
    if (!order || !isEditable) return
    if (items.length === 0) {
      toast({ title: 'Inclua ao menos um item', variant: 'destructive' })
      return
    }

    const paymentPayload = paymentEntriesToSalesPayload(paymentEntries, paymentMethodsCatalog)

    if (paymentPayload.length === 0) {
      toast({ title: 'Informe ao menos uma forma de pagamento', variant: 'destructive' })
      return
    }

    if (paymentsTotal < previewTotal) {
      toast({
        title: 'Pagamento insuficiente',
        description: 'A soma das formas de pagamento precisa cobrir o total da venda.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        customer_name: customerName.trim() || null,
        customer_type: customerType,
        customer_document: customerDocument.replace(/\D/g, '') || null,
        discount_total_cents: moneyToCentsFromMasked(discountMasked) ?? 0,
        surcharge_cents: moneyToCentsFromMasked(surchargeMasked) ?? 0,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit_price_cents: moneyToCentsFromMasked(item.unit_price_masked) ?? 0,
          unit_cost_cents: item.unit_cost_cents,
          discount_cents: moneyToCentsFromMasked(item.discount_masked) ?? 0,
        })),
        payments: paymentPayload,
      }

      const res = await portalFetch(`/api/portal/sales-orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao salvar pedido',
          variant: 'destructive',
        })
        return
      }

      const nextOrder = data.order as OrderDetail
      const nextPayments = (data.payments ?? []) as OrderPayment[]
      setOrder(nextOrder)
      setItems(toEditableItems((data.items ?? []) as OrderItem[]))
      setPayments(nextPayments)
      setPaymentEntries(paymentsToEntries(nextPayments))
      setDiscountMasked(maskedFromCents(nextOrder.discount_total_cents))
      setSurchargeMasked(maskedFromCents(nextOrder.surcharge_cents ?? 0))
      const matched = selectedCustomer?.id && !selectedCustomer.id.startsWith('local:')
        ? selectedCustomer
        : customerHitFromOrder(nextOrder)
      if (matched) {
        setSelectedCustomer(matched)
        const fields = applyCustomerFields(matched)
        setCustomerName(nextOrder.customer_name || fields.customerName)
        setCustomerType(fromDbCustomerType(nextOrder.customer_type))
        setCustomerDocument(onlyDigits(String(nextOrder.customer_document || '')))
      }
      toast({ title: 'Pedido atualizado' })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function cancelOrder () {
    if (!order) return
    const isPaid = order.status === 'paid'
    let reason = 'Cancelado no detalhe do pedido'
    if (isPaid) {
      const typed = window.prompt('Motivo do estorno da venda paga:')
      if (typed == null) return
      reason = typed.trim()
      if (!reason) {
        toast({ title: 'Informe o motivo do estorno', variant: 'destructive' })
        return
      }
      if (!confirm('Estornar esta venda paga? Estoque e financeiro serão revertidos.')) return
    } else if (!confirm(`Cancelar o pedido #${order.order_number}?`)) {
      return
    }

    setBusy(true)
    try {
      const res = await portalFetch(`/api/portal/sales-orders/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao cancelar',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: isPaid ? 'Venda estornada' : 'Pedido cancelado',
        description: data.bling_warning || undefined,
      })
      setOrder((prev) => prev ? { ...prev, status: 'canceled' } : prev)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!order) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        Carregando pedido...
      </div>
    )
  }

  const docFormatted = order.customer_document
    ? formatCpfCnpj(order.customer_document)
    : '—'

  return (
    <div className='space-y-4 py-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>Pedido #{order.order_number}</h1>
          <Badge className='mt-1' variant={order.status === 'paid' ? 'secondary' : order.status === 'canceled' ? 'destructive' : 'default'}>
            {statusLabel(order.status)}
          </Badge>
          {!isEditable ? (
            <p className='mt-2 text-sm text-muted-foreground'>
              Pedidos cancelados não podem ser editados.
            </p>
          ) : order.status === 'paid' ? (
            <p className='mt-2 text-sm text-muted-foreground'>
              Pedido finalizado: alterações atualizam estoque e financeiro automaticamente.
            </p>
          ) : null}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {isEditable ? (
            <Button type='button' disabled={saving} onClick={() => void saveOrder()}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          ) : null}
          <SalesOrderAfterSaleActions
            orderId={order.id}
            orderNumber={order.order_number}
            status={order.status}
            blingPedidoId={order.bling_pedido_id}
            blingNfceId={order.bling_nfce_id}
            onBlingUpdated={(bling) => {
              setOrder((prev) => prev
                ? {
                  ...prev,
                  bling_pedido_id: bling.blingPedidoId,
                  bling_nfce_id: bling.blingNfceId,
                }
                : prev)
            }}
          />
          {order.status === 'paid' || order.status === 'in_progress' ? (
            <Button
              type='button'
              variant='outline'
              className='text-destructive hover:text-destructive'
              disabled={busy}
              onClick={() => void cancelOrder()}
            >
              {order.status === 'paid' ? 'Estornar venda' : 'Cancelar pedido'}
            </Button>
          ) : null}
          <Link href='/portal/vendas'><Button variant='outline'>Voltar</Button></Link>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className='space-y-3 text-sm'>
            {isEditable ? (
              selectedCustomer ? (
                <div className='space-y-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium break-words'>{getCustomerDisplayName(selectedCustomer)}</p>
                      <p className='text-muted-foreground'>
                        {formatCpfCnpj(getCustomerDocumentDigits(selectedCustomer)) || 'Sem documento'}
                      </p>
                      <p className='text-muted-foreground'>
                        {customerType === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                      </p>
                    </div>
                    <div className='flex shrink-0 items-center gap-1'>
                      {selectedCustomer.id && !selectedCustomer.id.startsWith('local:') ? (
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          aria-label='Editar cliente'
                          onClick={() => setIsEditCustomerOpen(true)}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                      ) : null}
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        aria-label='Trocar cliente'
                        onClick={() => selectCustomer(null)}
                      >
                        <ArrowLeftRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='space-y-2'>
                  <Label htmlFor='customerSearchTrigger'>Buscar cliente</Label>
                  <Popover open={isCpfPopoverOpen} onOpenChange={setIsCpfPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        id='customerSearchTrigger'
                        type='button'
                        className={cn(
                          'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm',
                          'transition-colors hover:bg-accent/30',
                        )}
                      >
                        <span className={cn(!customerSearchInput ? 'text-muted-foreground' : '')}>
                          {customerSearchInput
                            ? (isDocumentMode ? formatCpfCnpj(documentDigits) : customerSearchInput)
                            : 'Digite o nome ou CPF/CNPJ (mín. 2 letras ou 5 números)'}
                        </span>
                        <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className='w-[min(520px,calc(100vw-2rem))] p-0' align='start'>
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder='Nome ou CPF/CNPJ…'
                          value={customerSearchInput}
                          onValueChange={(value) => {
                            if (/[a-zA-Z\u00C0-\u024F]/.test(value)) {
                              setCustomerSearchInput(value)
                              return
                            }
                            setCustomerSearchInput(formatCpfCnpj(value.replace(/\D/g, '')))
                          }}
                        />
                        <CommandList>
                          {customersFiltered.length === 0 ? (
                            <CommandEmpty>
                              {!isDocumentMode && !isNameMode
                                ? 'Digite pelo menos 2 letras (nome) ou 5 números (CPF/CNPJ).'
                                : documentSearchError
                                  ? documentSearchError
                                  : hasFetched
                                    ? 'Nenhum cliente encontrado.'
                                    : isSearchingDocument
                                      ? 'Buscando…'
                                      : 'Aguarde…'}
                            </CommandEmpty>
                          ) : null}
                          {customersFiltered.length > 0 ? (
                            <CommandGroup heading='Clientes'>
                              {customersFiltered.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={`${getCustomerDisplayName(customer)} ${getCustomerDocumentDigits(customer)}`}
                                  onSelect={() => selectCustomer(customer)}
                                >
                                  <Check className='mr-2 h-4 w-4 opacity-0' />
                                  <div className='flex flex-col'>
                                    <span className='font-medium'>{getCustomerDisplayName(customer)}</span>
                                    <span className='text-xs text-muted-foreground'>
                                      {formatCpfCnpj(getCustomerDocumentDigits(customer))}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ) : null}
                        </CommandList>
                        <div className='flex items-center justify-between gap-2 border-t p-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => selectCustomer(null)}
                          >
                            Consumidor Final
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            onClick={() => {
                              setIsCpfPopoverOpen(false)
                              setIsCreateCustomerOpen(true)
                            }}
                          >
                            <Plus className='mr-1 h-4 w-4' />
                            Cadastrar cliente
                          </Button>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className='text-xs text-muted-foreground'>
                    Sem cliente selecionado, a venda fica como Consumidor Final.
                  </p>
                </div>
              )
            ) : (
              <>
                <p><strong>Nome:</strong> {order.customer_name || 'Consumidor Final'}</p>
                <p><strong>Tipo:</strong> {customerType === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
                <p><strong>Documento:</strong> {docFormatted}</p>
              </>
            )}
            <p><strong>Criado em:</strong> {new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totais</CardTitle></CardHeader>
          <CardContent className='space-y-3 text-sm'>
            {isEditable ? (
              <>
                <p><strong>Subtotal:</strong> {maskedFromCents(previewSubtotal)}</p>
                <div className='space-y-1.5'>
                  <Label htmlFor='discount-total'>Desconto</Label>
                  <Input
                    id='discount-total'
                    inputMode='numeric'
                    value={discountMasked}
                    onChange={(e) => setDiscountMasked(formatMoneyInput(e.target.value))}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='surcharge-total'>Acréscimo</Label>
                  <Input
                    id='surcharge-total'
                    inputMode='numeric'
                    value={surchargeMasked}
                    onChange={(e) => setSurchargeMasked(formatMoneyInput(e.target.value))}
                  />
                </div>
                <p><strong>Total:</strong> {maskedFromCents(previewTotal)}</p>
                {order.status === 'paid' ? (
                  <>
                    <p><strong>Pago:</strong> {maskedFromCents(order.paid_amount_cents)}</p>
                    <p><strong>Troco:</strong> {maskedFromCents(Math.max(0, order.paid_amount_cents - previewTotal))}</p>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <p><strong>Subtotal:</strong> {maskedFromCents(order.subtotal_cents)}</p>
                <p><strong>Desconto:</strong> {maskedFromCents(order.discount_total_cents)}</p>
                <p><strong>Acréscimo:</strong> {maskedFromCents(order.surcharge_cents ?? 0)}</p>
                <p><strong>Total:</strong> {maskedFromCents(order.total_cents)}</p>
                <p><strong>Pago:</strong> {maskedFromCents(order.paid_amount_cents)}</p>
                <p><strong>Troco:</strong> {maskedFromCents(order.change_cents)}</p>
              </>
            )}
            {order.bling_pedido_id ? (
              <p><strong>Bling:</strong> pedido #{order.bling_pedido_id}{order.bling_nfce_id ? ` · NFC-e #${order.bling_nfce_id}` : ''}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {items.map((item) => (
            <div
              key={item.key}
              className='grid gap-3 rounded border p-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto]'
            >
              <div className='min-w-0'>
                <p className='font-medium'>{item.name}</p>
                {item.sku ? <p className='text-muted-foreground'>({item.sku})</p> : null}
              </div>
              {isEditable ? (
                <>
                  <div className='space-y-1'>
                    <Label>Qtd</Label>
                    <Input
                      type='number'
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label>Preço unit.</Label>
                    <Input
                      inputMode='numeric'
                      value={item.unit_price_masked}
                      onChange={(e) => updateItem(item.key, {
                        unit_price_masked: formatMoneyInput(e.target.value),
                      })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label>Desconto</Label>
                    <Input
                      inputMode='numeric'
                      value={item.discount_masked}
                      onChange={(e) => updateItem(item.key, {
                        discount_masked: formatMoneyInput(e.target.value),
                      })}
                    />
                  </div>
                  <div className='flex items-end justify-between gap-2 sm:flex-col sm:items-end'>
                    <span className='font-medium'>{maskedFromCents(itemSubtotalCents(item))}</span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 text-destructive'
                      aria-label={`Remover ${item.name}`}
                      onClick={() => removeItem(item.key)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </>
              ) : (
                <div className='flex items-center justify-between gap-3 sm:col-span-4'>
                  <span className='text-muted-foreground'>× {item.quantity}</span>
                  <span>{maskedFromCents(itemSubtotalCents(item))}</span>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 ? <p className='py-4 text-muted-foreground'>Sem itens</p> : null}
        </CardContent>
      </Card>

      {isEditable ? (
        <OrderPaymentMethodsCard
          value={paymentEntries}
          onChange={setPaymentEntries}
          totalValueCents={previewTotal}
          initialCatalog={paymentMethodsCatalog}
          title='Formas de pagamento'
          description='Selecione como o cliente pagou ou vai pagar esta venda.'
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Formas de pagamento</CardTitle></CardHeader>
          <CardContent className='divide-y'>
            {payments.map((payment) => (
              <div key={payment.id} className='flex items-center justify-between py-2 text-sm'>
                <span className='capitalize'>{payment.payment_method_type}</span>
                <span>{maskedFromCents(payment.amount_cents)}</span>
              </div>
            ))}
            {payments.length === 0 ? <p className='py-4 text-muted-foreground'>Sem pagamentos</p> : null}
          </CardContent>
        </Card>
      )}

      <CreateCustomerDialog
        open={isCreateCustomerOpen}
        onOpenChange={setIsCreateCustomerOpen}
        initialDocumentDigits={documentDigits}
        onCreated={(customer) => {
          selectCustomer(customer)
          setIsCreateCustomerOpen(false)
        }}
      />

      {selectedCustomer && !selectedCustomer.id.startsWith('local:') ? (
        <EditCustomerDialog
          open={isEditCustomerOpen}
          onOpenChange={setIsEditCustomerOpen}
          customer={selectedCustomer}
          onSaved={(customer) => {
            selectCustomer(customer)
            setIsEditCustomerOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
