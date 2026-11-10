'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PopoverAnchor } from '@radix-ui/react-popover'
import { Link2, Loader2, Pencil, Trash2 } from 'lucide-react'
import { searchLocalCatalog } from '@/app/(portal)/portal/pdv/pdv-catalog-cache'
import type { CatalogProduct } from '@/app/(portal)/portal/pdv/pdv-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateCustomerDialog, EditCustomerDialog, type CustomerHit } from '@/components/customers'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { syncCatalogSnapshot } from '@/lib/pdv/sync-catalog-snapshot'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { usePortalOrganizationId } from '@/lib/portal/portal-branding-context'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { csosnOptions } from '@/lib/fiscal/csosn-options'
import { ipiCstOptions, pisCofinsCstOptions } from '@/lib/fiscal/tax-cst-options'
import { fiscalPaymentTypeOptions } from '@/lib/fiscal/payment-type-options'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { NovaOrdemCustomerCard } from '@/app/(portal)/portal/ordens/nova/NovaOrdemCustomerCard'
import {
  useNovaOrdemCustomerSearch,
} from '@/app/(portal)/portal/ordens/nova/use-nova-ordem-customer-search'

type InboundItem = {
  id: string
  line_number: number
  item_kind?: 'product' | 'used_device'
  product_code: string | null
  barcode: string | null
  description: string
  ncm: string | null
  cest?: string | null
  unit: string | null
  cfop?: string | null
  fiscal_origin?: number | null
  icms_csosn?: string | null
  pis_cst?: string | null
  cofins_cst?: string | null
  ipi_cst?: string | null
  quantity: number
  unit_value_cents: number
  total_cents: number
  product_id: string | null
  resale_device_id?: string | null
  device_snapshot?: {
    device_name?: string
    color?: string | null
    storage_gb?: string | null
    imei?: string | null
  } | null
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  } | null
}

const fiscalOrigins = [
  ['0', 'Nacional'],
  ['1', 'Estrangeira, importação direta'],
  ['2', 'Estrangeira, adquirida no mercado interno'],
  ['3', 'Nacional, conteúdo de importação superior a 40%'],
  ['4', 'Nacional, processo produtivo básico'],
  ['5', 'Nacional, conteúdo de importação até 40%'],
  ['6', 'Estrangeira, importação direta sem similar nacional'],
  ['7', 'Estrangeira, mercado interno sem similar nacional'],
  ['8', 'Nacional, conteúdo de importação superior a 70%'],
] as const

function FiscalItemEditor ({
  documentId,
  item,
  disabled,
  onSaved,
}: {
  documentId: string
  item: InboundItem
  disabled: boolean
  onSaved: (document: InboundDoc) => void
}) {
  const [values, setValues] = useState({
    description: item.description,
    productCode: item.product_code || '',
    barcode: item.barcode || '',
    ncm: item.ncm || '',
    cest: item.cest || '',
    unit: item.unit || 'UN',
    quantity: String(item.quantity).replace('.', ','),
    unitValue: maskedFromCents(item.unit_value_cents),
    cfop: item.cfop || '1102',
    fiscalOrigin: String(item.fiscal_origin ?? 0),
    icmsCsosn: item.icms_csosn || '102',
    pisCst: item.pis_cst || '99',
    cofinsCst: item.cofins_cst || '99',
    ipiCst: item.ipi_cst || '53',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setValues({
      description: item.description,
      productCode: item.product_code || '',
      barcode: item.barcode || '',
      ncm: item.ncm || '',
      cest: item.cest || '',
      unit: item.unit || 'UN',
      quantity: String(item.quantity).replace('.', ','),
      unitValue: maskedFromCents(item.unit_value_cents),
      cfop: item.cfop || '1102',
      fiscalOrigin: String(item.fiscal_origin ?? 0),
      icmsCsosn: item.icms_csosn || '102',
      pisCst: item.pis_cst || '99',
      cofinsCst: item.cofins_cst || '99',
      ipiCst: item.ipi_cst || '53',
    })
  }, [item])

  function updateValue (key: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  async function save () {
    if (disabled || isSaving) return
    setIsSaving(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/items/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'fiscal',
            ncm: values.ncm,
            cest: values.cest || null,
            unit: values.unit,
            description: values.description,
            product_code: values.productCode,
            barcode: values.barcode,
            quantity: Number(values.quantity.replace(',', '.')),
            unit_value_cents: moneyToCentsFromMasked(values.unitValue) ?? 0,
            cfop: values.cfop,
            fiscal_origin: Number(values.fiscalOrigin),
            icms_csosn: values.icmsCsosn,
            pis_cst: values.pisCst,
            cofins_cst: values.cofinsCst,
            ipi_cst: values.ipiCst || null,
          }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível salvar os impostos',
          description: data?.message || data?.error || 'Revise os campos fiscais.',
          variant: 'destructive',
        })
        return
      }
      onSaved(data.document as InboundDoc)
      setIsOpen(false)
      toast({ title: 'Dados fiscais do item atualizados' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='ghost' size='icon' disabled={disabled} aria-label='Editar dados adicionais do item'>
          <Pencil className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Dados adicionais do item</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-1.5 sm:col-span-2'>
            <label className='text-sm font-medium'>Descrição do produto</label>
            <Input
              value={values.description}
              disabled={isSaving}
              onChange={(event) => updateValue('description', event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Código do produto</label>
            <Input
              value={values.productCode}
              disabled={isSaving}
              onChange={(event) => updateValue('productCode', event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Código de barras</label>
            <Input
              value={values.barcode}
              inputMode='numeric'
              disabled={isSaving}
              onChange={(event) => updateValue('barcode', event.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>NCM</label>
            <Input
              value={values.ncm}
              maxLength={8}
              inputMode='numeric'
              disabled={isSaving}
              onChange={(event) => updateValue('ncm', event.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Unidade</label>
            <Input
              value={values.unit}
              maxLength={6}
              disabled={isSaving}
              onChange={(event) => updateValue('unit', event.target.value.toUpperCase())}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Quantidade</label>
            <Input
              value={values.quantity}
              inputMode='decimal'
              disabled={isSaving}
              onChange={(event) => updateValue('quantity', event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Valor unitário</label>
            <Input
              value={values.unitValue}
              inputMode='numeric'
              disabled={isSaving}
              onChange={(event) => updateValue('unitValue', formatMoneyInput(event.target.value))}
            />
          </div>
          {[
            ['cest', 'CEST', 7],
            ['cfop', 'CFOP', 4],
          ].map(([key, label, maxLength]) => (
            <div key={String(key)} className='space-y-1.5'>
              <label className='text-sm font-medium'>{label}</label>
              <Input
                value={values[key as keyof typeof values]}
                maxLength={Number(maxLength)}
                disabled={isSaving}
                onChange={(event) => updateValue(key as keyof typeof values, event.target.value)}
              />
            </div>
          ))}
          <div className='space-y-1.5 sm:col-span-2'>
            <label className='text-sm font-medium'>CSOSN do ICMS</label>
            <Select
              value={values.icmsCsosn}
              disabled={isSaving}
              onValueChange={(value) => updateValue('icmsCsosn', value)}
            >
              <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
              <SelectContent>
                {csosnOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {[
            ['pisCst', 'CST PIS'],
            ['cofinsCst', 'CST COFINS'],
          ].map(([key, label]) => (
            <div key={key} className='space-y-1.5'>
              <label className='text-sm font-medium'>{label}</label>
              <Select
                value={values[key as 'pisCst' | 'cofinsCst']}
                disabled={isSaving}
                onValueChange={(value) => updateValue(key as 'pisCst' | 'cofinsCst', value)}
              >
                <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pisCofinsCstOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className='space-y-1.5 sm:col-span-2'>
            <label className='text-sm font-medium'>CST IPI</label>
            <Select
              value={values.ipiCst}
              disabled={isSaving}
              onValueChange={(value) => updateValue('ipiCst', value)}
            >
              <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
              <SelectContent>
                {ipiCstOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5 sm:col-span-2'>
            <label className='text-sm font-medium'>Origem da mercadoria</label>
            <Select
              value={values.fiscalOrigin}
              disabled={isSaving}
              onValueChange={(value) => updateValue('fiscalOrigin', value)}
            >
              <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
              <SelectContent>
                {fiscalOrigins.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{value} - {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type='button' disabled={isSaving} onClick={() => void save()}>
            {isSaving ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type InboundDoc = {
  id: string
  entry_kind?: 'products' | 'used_devices'
  source_mode?: 'xml' | 'manual'
  entry_type?: 'own_issuance' | 'third_party' | 'import' | 'xml_import'
  access_key: string | null
  series: number
  number: number
  issued_at: string | null
  issuer_cnpj: string | null
  issuer_name: string | null
  seller_name?: string | null
  seller_document?: string | null
  seller_customer_id?: string | null
  fiscal_purpose: 'resale' | 'fixed_asset' | 'use_consumption'
  should_move_stock: boolean
  operation_nature: string
  freight_cents: number
  insurance_cents: number
  other_expenses_cents: number
  discount_cents: number
  transport_mode: 'none' | 'buyer' | 'seller' | 'carrier'
  complementary_information: string | null
  fiscal_information: string | null
  fiscal_payments: Array<{ type: string, value_cents: number }>
  total_cents: number
  status: 'draft' | 'posted' | 'canceled'
  fiscal_document?: {
    id: string
    status: string
    series: number
    number: number
    access_key: string | null
    sefaz_status_message: string | null
  } | null
  items?: InboundItem[]
}

type Props = {
  documentId: string
}

function StockProductSearch ({
  query,
  hits,
  isCatalogLoading,
  disabled,
  onQueryChange,
  onPick,
}: {
  query: string
  hits: CatalogProduct[]
  isCatalogLoading: boolean
  disabled: boolean
  onQueryChange: (value: string) => void
  onPick: (product: CatalogProduct) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const canSearch = query.trim().length >= 2

  return (
    <Popover open={isOpen && canSearch} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div className='relative'>
          <Input
            value={query}
            placeholder='Buscar produto...'
            autoComplete='off'
            disabled={disabled}
            onChange={(event) => {
              onQueryChange(event.target.value)
              setIsOpen(event.target.value.trim().length >= 2)
            }}
            onFocus={() => {
              if (canSearch) setIsOpen(true)
            }}
          />
          {isCatalogLoading ? (
            <Loader2 className='absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground' />
          ) : (
            <Link2 className='pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground' />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align='start'
        sideOffset={4}
        className='z-50 w-[var(--radix-popover-trigger-width)] min-w-64 p-1'
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {isCatalogLoading && hits.length === 0 ? (
          <p className='px-3 py-2 text-sm text-muted-foreground'>Carregando catálogo...</p>
        ) : hits.length === 0 ? (
          <p className='px-3 py-2 text-sm text-muted-foreground'>Nenhum produto encontrado.</p>
        ) : (
          <ul className='max-h-64 overflow-auto'>
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type='button'
                  className='flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm hover:bg-accent'
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(hit)
                    setIsOpen(false)
                  }}
                >
                  <span className='font-medium'>{hit.name}</span>
                  <span className='text-xs text-muted-foreground'>
                    {[hit.sku, hit.barcode].filter(Boolean).join(' · ') || 'Sem SKU'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function formatDate (value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

export function InboundNfeDetail ({ documentId }: Props) {
  const router = useRouter()
  const organizationId = usePortalOrganizationId()
  const [document, setDocument] = useState<InboundDoc | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)
  const [createCustomerInitialDocument, setCreateCustomerInitialDocument] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSavingFiscalSettings, setIsSavingFiscalSettings] = useState(false)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [savingInlineItemId, setSavingInlineItemId] = useState<string | null>(null)
  const [searchByItem, setSearchByItem] = useState<Record<string, string>>({})
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
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

  async function load () {
    setIsLoading(true)
    try {
      const res = await portalFetch(`/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}`)
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        setDocument(null)
        return
      }
      const loadedDocument = data.document as InboundDoc
      setDocument(loadedDocument)
      if (loadedDocument.seller_customer_id) {
        const customerRes = await portalFetch(
          `/api/portal/customers/${encodeURIComponent(loadedDocument.seller_customer_id)}`,
        )
        const customerData = await customerRes?.json().catch(() => null)
        setSelectedCustomer(customerData?.ok ? customerData.customer as CustomerHit : null)
      } else {
        setSelectedCustomer(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [documentId])

  useEffect(() => {
    if (!organizationId) {
      setCatalog([])
      setIsCatalogLoading(false)
      return
    }
    let cancelled = false
    setIsCatalogLoading(true)
    void syncCatalogSnapshot(organizationId, {
      onProducts: (products) => {
        if (!cancelled) setCatalog(products)
      },
    }).finally(() => {
      if (!cancelled) setIsCatalogLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const stockCatalog = useMemo(
    () => catalog.filter((product) => product.kind !== 'service'),
    [catalog],
  )

  const items = document?.items || []
  const isUsed = document?.entry_kind === 'used_devices'
  const unlinkedCount = useMemo(
    () => (isUsed ? 0 : items.filter((item) => !item.product_id).length),
    [items, isUsed],
  )
  const linkedCount = isUsed ? items.length : items.length - unlinkedCount
  const isDraft = document?.status === 'draft' &&
    (!document.fiscal_document || document.fiscal_document.status === 'rejected')
  const fiscalPayment = document?.fiscal_payments?.[0] || null

  async function selectSellerCustomer (customer: CustomerHit) {
    if (!document || !isDraft || isSavingFiscalSettings) return
    setIsSavingFiscalSettings(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seller_customer_id: customer.id }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível alterar o cliente',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      setSelectedCustomer(customer)
      setIsCpfPopoverOpen(false)
      toast({ title: 'Cliente da NF-e atualizado' })
    } finally {
      setIsSavingFiscalSettings(false)
    }
  }

  function clearSellerCustomer () {
    setSelectedCustomer(null)
    setCustomerSearchInput('')
    setIsCpfPopoverOpen(true)
  }

  function editSellerCustomer () {
    if (!selectedCustomer) return
    setCustomerToEdit(selectedCustomer)
    setIsCustomerDialogOpen(true)
  }

  function createSellerCustomer () {
    setCreateCustomerInitialDocument(documentDigits)
    setCustomerToEdit(null)
    setIsCpfPopoverOpen(false)
    setIsCustomerDialogOpen(true)
  }

  async function saveFiscalSettings (
    fiscalPurpose: InboundDoc['fiscal_purpose'],
    shouldMoveStock: boolean,
  ) {
    if (!document || !isDraft || isSavingFiscalSettings) return
    setIsSavingFiscalSettings(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fiscal_purpose: fiscalPurpose,
            should_move_stock: shouldMoveStock,
          }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível atualizar',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      toast({ title: 'Dados fiscais atualizados' })
    } finally {
      setIsSavingFiscalSettings(false)
    }
  }

  async function saveAdditionalSettings (patch: Record<string, unknown>) {
    if (!document || !isDraft || isSavingFiscalSettings) return
    setIsSavingFiscalSettings(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fiscal_purpose: document.fiscal_purpose,
            should_move_stock: document.should_move_stock,
            operation_nature: document.operation_nature,
            ...patch,
          }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível atualizar',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
    } finally {
      setIsSavingFiscalSettings(false)
    }
  }

  function updateProductSearch (itemId: string, query: string) {
    setSearchByItem((prev) => ({ ...prev, [itemId]: query }))
  }

  async function linkProduct (itemId: string, productId: string | null) {
    if (!isDraft || linkingItemId || isUsed) return
    setLinkingItemId(itemId)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível vincular',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      setSearchByItem((prev) => ({ ...prev, [itemId]: '' }))
    } finally {
      setLinkingItemId(null)
    }
  }

  async function saveInlineItem (item: InboundItem, patch: Record<string, unknown>) {
    if (!isDraft || savingInlineItemId) return
    setSavingInlineItemId(item.id)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/items/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'fiscal',
            ncm: item.ncm || '',
            cest: item.cest || null,
            unit: item.unit || 'UN',
            cfop: item.cfop || '1102',
            fiscal_origin: item.fiscal_origin ?? 0,
            icms_csosn: item.icms_csosn || '102',
            pis_cst: item.pis_cst || '99',
            cofins_cst: item.cofins_cst || '99',
            ipi_cst: item.ipi_cst || null,
            quantity: item.quantity,
            unit_value_cents: item.unit_value_cents,
            ...patch,
          }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível atualizar o item',
          description: data?.message || data?.error || 'Revise os valores.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
    } finally {
      setSavingInlineItemId(null)
    }
  }

  async function deleteItem (item: InboundItem) {
    if (!isDraft || savingInlineItemId || items.length <= 1) return
    const confirmed = await appConfirm({
      title: 'Excluir item da NF-e?',
      description: item.description,
      confirmLabel: 'Excluir item',
      destructive: true,
    })
    if (!confirmed) return

    setSavingInlineItemId(item.id)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/items/${encodeURIComponent(item.id)}`,
        { method: 'DELETE' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível excluir',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      toast({ title: 'Item excluído' })
    } finally {
      setSavingInlineItemId(null)
    }
  }

  async function sendToSefaz () {
    if (!document || !isDraft || isSending) return
    const confirmed = await appConfirm({
      title: 'Enviar NF-e de entrada à SEFAZ?',
      description: `Vendedor: ${document.seller_name || 'Não informado'}. Total: R$ ${maskedFromCents(document.total_cents)}. A transmissão reservará uma numeração fiscal real e não poderá ser tratada como simples rascunho.`,
      confirmLabel: 'Enviar à SEFAZ',
    })
    if (!confirmed) return

    setIsSending(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/emit`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'NF-e não enviada',
          description: data?.message || data?.error || 'Revise os dados fiscais e tente novamente.',
          variant: 'destructive',
        })
        return
      }
      toast({
        variant: 'success',
        title: 'NF-e autorizada',
        description: `Número fiscal ${data.fiscalDocument?.series}/${data.fiscalDocument?.number}.`,
      })
      if (data.danfe_url) {
        window.open(String(data.danfe_url), '_blank', 'noopener,noreferrer')
      }
      router.push('/portal/vendas/nfe/entradas')
    } finally {
      setIsSending(false)
    }
  }

  async function postToStock () {
    if (!isDraft || isPosting) return
    if (!isUsed && linkedCount === 0) {
      toast({
        title: 'Nenhum produto vinculado',
        description: 'Vincule ao menos um item. Os que não estão cadastrados podem ficar de fora.',
        variant: 'destructive',
      })
      return
    }
    const skippedNote = !isUsed && unlinkedCount > 0
      ? ` ${linkedCount} ${linkedCount === 1 ? 'item entra' : 'itens entram'} no estoque. ${unlinkedCount} ${unlinkedCount === 1 ? 'fica de fora' : 'ficam de fora'}, sem produto vinculado.`
      : ''
    const confirmed = await appConfirm({
      title: isUsed ? 'Lançar aparelhos no estoque?' : 'Lançar entrada no estoque?',
      description: isUsed
        ? 'Cada aparelho será cadastrado como seminovo. Se houver forma de pagamento, gera saída financeira.'
        : `As quantidades vinculadas serão somadas ao estoque e o custo desses produtos poderá ser atualizado.${skippedNote}`,
      confirmLabel: isUsed ? 'Lançar usados' : 'Lançar estoque',
    })
    if (!confirmed) return

    setIsPosting(true)
    try {
      const res = await portalFetch(
        `/api/portal/fiscal/inbound-nfe/${encodeURIComponent(documentId)}/post`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Falha ao lançar',
          description: data?.message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      setDocument(data.document as InboundDoc)
      toast({
        title: 'Entrada lançada',
        description: isUsed
          ? 'Aparelhos cadastrados no estoque de seminovos.'
          : unlinkedCount > 0
            ? `${linkedCount} ${linkedCount === 1 ? 'item lançado' : 'itens lançados'}. ${unlinkedCount} ${unlinkedCount === 1 ? 'ficou' : 'ficaram'} sem vínculo.`
            : 'Estoque atualizado com base na NF-e de entrada.',
      })
    } finally {
      setIsPosting(false)
    }
  }

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Carregando NF-e...</p>
  }

  if (!document) {
    return (
      <div className='space-y-3'>
        <p className='text-sm text-muted-foreground'>NF-e de entrada não encontrada.</p>
        <Link href='/portal/vendas/nfe/entradas'>
          <Button type='button' variant='outline'>Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='order-1 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-lg font-medium'>
              NF-e entrada {document.series}/{document.number}
            </h2>
            <Badge variant={
              document.fiscal_document?.status === 'authorized' || document.status === 'posted'
                ? 'default'
                : 'secondary'
            }>
              {document.fiscal_document?.status === 'authorized'
                ? 'Autorizada'
                : document.status === 'posted'
                  ? 'Lançada'
                  : document.status === 'canceled'
                    ? 'Cancelada'
                    : 'Rascunho'}
            </Badge>
            <Badge variant='outline'>
              {isUsed
                ? 'Usados'
                : document.source_mode === 'manual'
                  ? 'Produtos (manual)'
                  : 'Produtos (XML)'}
            </Badge>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {isUsed
              ? (document.seller_name || document.issuer_name || 'Cliente')
              : document.source_mode === 'manual'
                ? (document.seller_name || 'Vendedor')
                : (document.issuer_name || 'Emitente')}
            {' · '}
            {formatDate(document.issued_at)}
          </p>
          {document.access_key ? (
            <p className='mt-1 font-mono text-xs text-muted-foreground break-all'>
              Chave {document.access_key}
            </p>
          ) : null}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link href='/portal/vendas/nfe/entradas'>
            <Button type='button' variant='outline'>Cancelar</Button>
          </Link>
          <Button
            type='button'
            variant='outline'
            disabled={!isDraft || isSending || isSavingFiscalSettings || Boolean(savingInlineItemId) || Boolean(linkingItemId)}
            onClick={() => {
              toast({ variant: 'success', title: 'NF-e salva' })
              router.push('/portal/vendas/nfe/entradas')
            }}
          >
            Salvar
          </Button>
          {document.entry_type === 'own_issuance' && isDraft ? (
            <Button
              type='button'
              disabled={isSending || isSavingFiscalSettings || Boolean(savingInlineItemId) || Boolean(linkingItemId)}
              onClick={() => void sendToSefaz()}
            >
              {isSending ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
              Enviar à SEFAZ
            </Button>
          ) : null}
        </div>
      </div>

      {document.source_mode === 'manual' && isDraft ? (
        <div className='order-2'>
          <NovaOrdemCustomerCard
            selectedCustomer={selectedCustomer}
            searchInput={customerSearchInput}
            documentDigits={documentDigits}
            onSearchInputChange={setCustomerSearchInput}
            isCpfPopoverOpen={isCpfPopoverOpen}
            onCpfPopoverOpenChange={setIsCpfPopoverOpen}
            customersFiltered={customersFiltered}
            isSearchingDocument={isSearchingDocument}
            documentSearchError={documentSearchError}
            hasFetched={hasFetched}
            isDocumentMode={isDocumentMode}
            isNameMode={isNameMode}
            onSelectCustomer={(customer) => void selectSellerCustomer(customer)}
            onClearCustomer={clearSellerCustomer}
            onEditCustomer={editSellerCustomer}
            onCreateCustomer={createSellerCustomer}
          />
        </div>
      ) : null}

      {document.source_mode === 'manual' ? (
        <Card className='order-2'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Configuração fiscal e estoque</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
            <div className='space-y-1.5'>
              <label htmlFor='inbound-purpose' className='text-sm font-medium'>Finalidade</label>
              <Select
                value={document.fiscal_purpose}
                disabled={!isDraft || isSavingFiscalSettings}
                onValueChange={(value: InboundDoc['fiscal_purpose']) => {
                  void saveFiscalSettings(
                    value,
                    value === 'resale' ? document.should_move_stock : false,
                  )
                }}
              >
                <SelectTrigger id='inbound-purpose'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='resale'>Mercadoria para revenda</SelectItem>
                  <SelectItem value='fixed_asset'>Ativo imobilizado</SelectItem>
                  <SelectItem value='use_consumption'>Uso ou consumo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-start justify-between gap-4 rounded-md border p-3'>
              <div>
                <label htmlFor='inbound-stock' className='text-sm font-medium'>Movimentar estoque</label>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Desative se estes itens já estiverem no estoque.
                </p>
              </div>
              <Switch
                id='inbound-stock'
                checked={document.should_move_stock}
                disabled={!isDraft || isSavingFiscalSettings || document.fiscal_purpose !== 'resale'}
                onCheckedChange={(checked) => {
                  void saveFiscalSettings(document.fiscal_purpose, checked)
                }}
              />
            </div>
            <p className='text-xs text-muted-foreground sm:col-span-2'>
              Este registro é um rascunho interno. Ele só terá validade fiscal depois da autorização da NF-e pela SEFAZ.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {document.source_mode === 'manual' ? (
        <Card className='order-4'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Totais, transporte e informações adicionais</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='max-w-md space-y-1.5'>
              <label htmlFor='detail-transport-mode' className='text-sm font-medium'>Transporte</label>
              <Select
                value={document.transport_mode}
                disabled={!isDraft || isSavingFiscalSettings}
                onValueChange={(value: InboundDoc['transport_mode']) => {
                  void saveAdditionalSettings(value === 'none'
                    ? {
                      transport_mode: value,
                      freight_cents: 0,
                      insurance_cents: 0,
                      other_expenses_cents: 0,
                      discount_cents: 0,
                    }
                    : { transport_mode: value })
                }}
              >
                <SelectTrigger id='detail-transport-mode'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sem transporte</SelectItem>
                  <SelectItem value='buyer'>Frete por conta da Conectize</SelectItem>
                  <SelectItem value='seller'>Frete por conta do vendedor</SelectItem>
                  <SelectItem value='carrier'>Transportadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {document.transport_mode !== 'none' ? (
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {[
                  ['Frete', 'freight_cents', document.freight_cents],
                  ['Seguro', 'insurance_cents', document.insurance_cents],
                  ['Outras despesas', 'other_expenses_cents', document.other_expenses_cents],
                  ['Desconto', 'discount_cents', document.discount_cents],
                ].map(([label, key, cents]) => (
                  <div key={String(key)} className='space-y-1.5'>
                    <label className='text-sm font-medium'>{String(label)}</label>
                    <Input
                      key={`${key}-${cents}`}
                      defaultValue={maskedFromCents(Number(cents))}
                      disabled={!isDraft || isSavingFiscalSettings}
                      onChange={(event) => {
                        event.target.value = formatMoneyInput(event.target.value)
                      }}
                      onBlur={(event) => {
                        void saveAdditionalSettings({
                          [String(key)]: moneyToCentsFromMasked(event.target.value) ?? 0,
                        })
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <div className='grid gap-3 border-t pt-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label htmlFor='detail-payment-type' className='text-sm font-medium'>
                  Forma de pagamento
                </label>
                <Select
                  value={fiscalPayment?.type || undefined}
                  disabled={!isDraft || isSavingFiscalSettings}
                  onValueChange={(value) => {
                    void saveAdditionalSettings({
                      fiscal_payments: [{
                        type: value,
                        value_cents: value === '90' ? 0 : document.total_cents,
                      }],
                    })
                  }}
                >
                  <SelectTrigger id='detail-payment-type' className='bg-transparent'>
                    <SelectValue placeholder='Selecione' />
                  </SelectTrigger>
                  <SelectContent>
                    {fiscalPaymentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <label htmlFor='detail-payment-value' className='text-sm font-medium'>Valor pago</label>
                <Input
                  id='detail-payment-value'
                  key={`${fiscalPayment?.type}-${fiscalPayment?.value_cents}`}
                  defaultValue={maskedFromCents(fiscalPayment?.value_cents || 0)}
                  inputMode='numeric'
                  disabled={!isDraft || isSavingFiscalSettings || !fiscalPayment || fiscalPayment.type === '90'}
                  onChange={(event) => {
                    event.target.value = formatMoneyInput(event.target.value)
                  }}
                  onBlur={(event) => {
                    if (!fiscalPayment || fiscalPayment.type === '90') return
                    void saveAdditionalSettings({
                      fiscal_payments: [{
                        type: fiscalPayment.type,
                        value_cents: moneyToCentsFromMasked(event.target.value) ?? 0,
                      }],
                    })
                  }}
                />
              </div>
              <p className='text-xs text-muted-foreground sm:col-span-2'>
                Usado no XML da NF-e, sem criar movimentação financeira automaticamente.
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label htmlFor='detail-complementary' className='text-sm font-medium'>
                  Informações complementares
                </label>
                <textarea
                  id='detail-complementary'
                  className='min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm'
                  defaultValue={document.complementary_information || ''}
                  disabled={!isDraft || isSavingFiscalSettings}
                  onBlur={(event) => {
                    void saveAdditionalSettings({ complementary_information: event.target.value })
                  }}
                />
              </div>
              <div className='space-y-1.5'>
                <label htmlFor='detail-fiscal-info' className='text-sm font-medium'>
                  Informações de interesse do fisco
                </label>
                <textarea
                  id='detail-fiscal-info'
                  className='min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm'
                  defaultValue={document.fiscal_information || ''}
                  disabled={!isDraft || isSavingFiscalSettings}
                  onBlur={(event) => {
                    void saveAdditionalSettings({ fiscal_information: event.target.value })
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className='order-5'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Resumo</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-2 text-sm sm:grid-cols-3'>
          <div>
            <p className='text-muted-foreground'>Total</p>
            <p className='font-medium'>{maskedFromCents(document.total_cents)}</p>
          </div>
          <div>
            <p className='text-muted-foreground'>{isUsed || document.source_mode === 'manual' ? 'Documento vendedor' : 'CNPJ emitente'}</p>
            <p className='font-medium'>
              {isUsed || document.source_mode === 'manual'
                ? (document.seller_document || 'Não informado')
                : (document.issuer_cnpj || 'Não informado')}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground'>{isUsed ? 'Aparelhos' : 'Itens sem vínculo'}</p>
            <p className='font-medium'>{isUsed ? items.length : unlinkedCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card className='order-3'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{isUsed ? 'Aparelhos' : 'Itens da nota fiscal'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Produto</TableHead>
                {!isUsed ? <TableHead>NCM</TableHead> : null}
                <TableHead>UN</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Valor un.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className='text-right'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.line_number}</TableCell>
                  <TableCell className='min-w-56 max-w-md whitespace-normal'>
                    <p className='font-medium break-words'>{item.description}</p>
                    <p className='text-xs text-muted-foreground'>
                      {isUsed
                        ? [
                          item.device_snapshot?.color,
                          item.device_snapshot?.storage_gb,
                          item.device_snapshot?.imei ? `IMEI ${item.device_snapshot.imei}` : null,
                        ].filter(Boolean).join(' · ') || '—'
                        : [
                          item.product_code,
                          item.barcode,
                        ].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {!isUsed && item.product ? (
                      <p className='mt-1 text-xs text-primary'>{item.product.name}</p>
                    ) : null}
                  </TableCell>
                  {!isUsed ? (
                    <TableCell className='min-w-32'>
                      <Input
                        key={`${item.id}-ncm-${item.ncm}`}
                        defaultValue={item.ncm || ''}
                        maxLength={8}
                        inputMode='numeric'
                        disabled={!isDraft || savingInlineItemId === item.id}
                        onBlur={(event) => {
                          const ncm = event.target.value.replace(/\D/g, '')
                          if (ncm !== (item.ncm || '')) void saveInlineItem(item, { ncm })
                        }}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className='min-w-24'>
                    {isUsed ? (
                      item.unit || 'UN'
                    ) : (
                      <Input
                        key={`${item.id}-unit-${item.unit}`}
                        defaultValue={item.unit || 'UN'}
                        maxLength={6}
                        disabled={!isDraft || savingInlineItemId === item.id}
                        onBlur={(event) => {
                          const unit = event.target.value.trim().toUpperCase()
                          if (unit && unit !== item.unit) void saveInlineItem(item, { unit })
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isUsed ? (
                      item.quantity
                    ) : (
                      <Input
                        key={`${item.id}-quantity-${item.quantity}`}
                        className='min-w-20'
                        defaultValue={String(item.quantity).replace('.', ',')}
                        inputMode='decimal'
                        disabled={!isDraft || savingInlineItemId === item.id}
                        onBlur={(event) => {
                          const quantity = Number(event.target.value.replace(',', '.'))
                          if (quantity !== item.quantity) void saveInlineItem(item, { quantity })
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell className='min-w-28'>
                    {isUsed ? (
                      maskedFromCents(item.unit_value_cents)
                    ) : (
                      <Input
                        key={`${item.id}-value-${item.unit_value_cents}`}
                        defaultValue={maskedFromCents(item.unit_value_cents)}
                        inputMode='numeric'
                        disabled={!isDraft || savingInlineItemId === item.id}
                        onChange={(event) => {
                          event.target.value = formatMoneyInput(event.target.value)
                        }}
                        onBlur={(event) => {
                          const unitValueCents = moneyToCentsFromMasked(event.target.value) ?? 0
                          if (unitValueCents !== item.unit_value_cents) {
                            void saveInlineItem(item, { unit_value_cents: unitValueCents })
                          }
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{maskedFromCents(item.total_cents)}</TableCell>
                  <TableCell className='min-w-[220px] text-right'>
                    {isUsed ? (
                      item.resale_device_id ? (
                        <Link
                          href={revendaPath.device(item.resale_device_id)}
                          className='text-sm font-medium text-primary underline-offset-2 hover:underline'
                        >
                          Abrir seminovo
                        </Link>
                      ) : (
                        <span className='text-sm text-muted-foreground'>
                          {isDraft ? 'Será criado ao lançar' : '—'}
                        </span>
                      )
                    ) : (
                      <div className='flex items-center justify-end gap-1'>
                        {!item.product && isDraft ? (
                          <div className='w-44 text-left'>
                            <StockProductSearch
                              query={searchByItem[item.id] || ''}
                              hits={searchLocalCatalog(stockCatalog, searchByItem[item.id] || '', 12)}
                              isCatalogLoading={isCatalogLoading}
                              disabled={linkingItemId === item.id}
                              onQueryChange={(value) => updateProductSearch(item.id, value)}
                              onPick={(product) => void linkProduct(item.id, product.id)}
                            />
                          </div>
                        ) : null}
                        <FiscalItemEditor
                          documentId={documentId}
                          item={item}
                          disabled={!isDraft}
                          onSaved={setDocument}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='text-destructive hover:text-destructive'
                          disabled={!isDraft || items.length <= 1 || savingInlineItemId === item.id}
                          aria-label='Excluir item da NF-e'
                          onClick={() => void deleteItem(item)}
                        >
                          {savingInlineItemId === item.id
                            ? <Loader2 className='h-4 w-4 animate-spin' />
                            : <Trash2 className='h-4 w-4' />}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {customerToEdit ? (
        <EditCustomerDialog
          open={isCustomerDialogOpen}
          onOpenChange={setIsCustomerDialogOpen}
          customer={customerToEdit}
          onSaved={(customer) => void selectSellerCustomer(customer)}
        />
      ) : (
        <CreateCustomerDialog
          open={isCustomerDialogOpen}
          onOpenChange={setIsCustomerDialogOpen}
          initialDocumentDigits={createCustomerInitialDocument}
          mode='create'
          onCreated={(customer) => void selectSellerCustomer(customer)}
        />
      )}
    </div>
  )
}
