'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Barcode,
  Hash,
  Loader2,
  Minus,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isSafeProductListImageUrl } from '@/app/(portal)/portal/produtos/product-list-shared'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents, moneyToCentsFromMasked, formatMoneyInput } from '@/lib/utils/money'
import { formatCpf, formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  PAYMENT_METHOD_LABELS,
  type CashCloseSummary,
  type PaymentMethodType,
} from '@/lib/pdv/cash-close-summary'
import { fromDbCustomerType } from '@/lib/sales-orders/customer-type'

type CatalogProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  cost_price_cents?: number | null
  image_url: string | null
  stock: number
}

type CartItem = {
  lineId: string
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  unitCostCents: number
  discountCents: number
}

function createCartLineId () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cartLineDiscountPerUnit (item: CartItem) {
  const qty = Math.max(1, item.quantity)
  return Math.round(item.discountCents / qty)
}

function cartLinesMatch (a: CartItem, b: CartItem) {
  return a.productId === b.productId
    && a.unitPriceCents === b.unitPriceCents
    && a.unitCostCents === b.unitCostCents
    && cartLineDiscountPerUnit(a) === cartLineDiscountPerUnit(b)
}

function cartLineSubtotalCents (item: CartItem) {
  return Math.max(0, item.quantity * item.unitPriceCents - item.discountCents)
}

type PaymentLine = {
  payment_method_id?: string | null
  payment_method_type: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'
  amountMasked: string
}

type PaymentMethod = {
  id: string
  description: string
  type: 'dinheiro' | 'pix_direto' | 'pix_maquina' | 'credito' | 'debito'
}

type OrderSummary = {
  id: string
  order_number: number
  status: 'in_progress' | 'paid' | 'canceled'
  customer_name: string | null
  total_cents: number
  created_at: string
}

type PdvClientProps = {
  sellerName: string
}

function normalizePaymentType (type: PaymentMethod['type']): PaymentLine['payment_method_type'] {
  if (type === 'pix_direto' || type === 'pix_maquina') return 'pix'
  if (type === 'credito') return 'credito'
  if (type === 'debito') return 'debito'
  if (type === 'dinheiro') return 'dinheiro'
  return 'outro'
}

function pickDefaultPaymentMethod (methods: PaymentMethod[]) {
  return methods.find((m) => m.type === 'dinheiro') ?? methods[0] ?? null
}

function buildDefaultPaymentLine (totalCents: number, methods: PaymentMethod[]): PaymentLine {
  const method = pickDefaultPaymentMethod(methods)
  return {
    payment_method_id: method?.id ?? null,
    payment_method_type: method ? normalizePaymentType(method.type) : 'dinheiro',
    amountMasked: maskedFromCents(totalCents),
  }
}

function mergeCartItem (prev: CartItem[], newItem: CartItem) {
  const idx = prev.findIndex((item) => cartLinesMatch(item, newItem))
  if (idx < 0) {
    return [...prev, { ...newItem, lineId: newItem.lineId || createCartLineId() }]
  }
  const next = [...prev]
  next[idx] = {
    ...next[idx],
    quantity: next[idx].quantity + newItem.quantity,
    discountCents: next[idx].discountCents + newItem.discountCents,
  }
  return next
}

function sortOrders (orders: OrderSummary[]) {
  const statusRank = { in_progress: 0, paid: 1, canceled: 2 }
  return [...orders].sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status]
    if (rankDiff !== 0) return rankDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function mapCatalogProduct (raw: Record<string, unknown>): CatalogProduct {
  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    sku: raw.sku != null ? String(raw.sku) : null,
    barcode: raw.barcode != null ? String(raw.barcode) : null,
    sale_price_cents: raw.sale_price_cents != null ? Number(raw.sale_price_cents) : null,
    image_url: raw.image_url != null ? String(raw.image_url) : null,
    stock: Number(raw.stock) || 0,
  }
}

const inputGroupShell = 'flex h-9 w-full overflow-hidden rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
const insertFormFieldClass = 'min-w-0 md:flex-[1_1_5rem]'
const pdvColumnHeaderClass = 'flex h-10 shrink-0 items-center border-b px-4'
const pdvColumnTitleClass = 'text-sm font-medium leading-none'

function QuantityStepper ({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  function handleInputChange (raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      onChange(1)
      return
    }
    onChange(Math.max(1, Number.parseInt(digits, 10) || 1))
  }

  return (
    <div className={inputGroupShell} role='group' aria-label='Quantidade'>
      <button
        type='button'
        disabled={disabled || value <= 1}
        className='flex w-6 shrink-0 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus className='h-3.5 w-3.5' />
      </button>
      <input
        type='text'
        inputMode='numeric'
        disabled={disabled}
        value={String(value)}
        onChange={(e) => handleInputChange(e.target.value)}
        className='min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50'
      />
      <button
        type='button'
        disabled={disabled}
        className='flex w-6 shrink-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
        onClick={() => onChange(value + 1)}
      >
        <Plus className='h-3.5 w-3.5' />
      </button>
    </div>
  )
}

function DiscountField ({
  value,
  onChange,
  mode,
  onModeToggle,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  mode: 'fixed' | 'percent'
  onModeToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className={inputGroupShell} role='group' aria-label='Desconto do item'>
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(
          mode === 'percent'
            ? e.target.value.replace(/[^\d,]/g, '')
            : formatMoneyInput(e.target.value),
        )}
        placeholder={mode === 'percent' ? '0' : '0,00'}
        className='min-w-0 flex-1 border-0 bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
      />
      <button
        type='button'
        disabled={disabled}
        onClick={onModeToggle}
        className='flex w-9 shrink-0 items-center justify-center border-l border-input bg-primary text-xs font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50'
      >
        {mode === 'fixed' ? 'R$' : '%'}
      </button>
    </div>
  )
}

function ProductThumbImage ({ src, alt, eager }: { src: string, alt: string, eager?: boolean }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className='flex h-full w-full items-center justify-center bg-muted'>
        <Package className='h-5 w-5 text-muted-foreground/50' />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className='absolute inset-0 h-full w-full object-cover'
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      referrerPolicy='no-referrer'
      onError={() => setHasError(true)}
    />
  )
}

function ProductPreview ({ product }: { product: CatalogProduct | null }) {
  const [previewImageError, setPreviewImageError] = useState(false)

  useEffect(() => {
    setPreviewImageError(false)
  }, [product?.id])

  if (!product) {
    return (
      <div className='flex h-full min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground'>
        Selecione um produto
      </div>
    )
  }

  const imageUrl = product.image_url && isSafeProductListImageUrl(product.image_url)
    ? product.image_url
    : null
  const stockLow = product.stock <= 0
  const showPreviewImage = Boolean(imageUrl) && !previewImageError

  return (
    <div className='flex h-full min-h-0 flex-1 gap-2 overflow-hidden'>
      <div className='relative flex h-full min-h-0 w-2/3 shrink-0 items-center justify-center rounded-xl border border-border'>
        {showPreviewImage && imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className='h-full w-full object-contain p-3'
            loading='eager'
            decoding='async'
            referrerPolicy='no-referrer'
            onError={() => setPreviewImageError(true)}
          />
        ) : (
          <div className='flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground'>
            <Package className='h-10 w-10 opacity-40' />
            <span className='text-xs'>Sem foto</span>
          </div>
        )}
      </div>
      <div className='flex h-full min-h-0 w-1/3 min-w-0 flex-col gap-2'>
        <p className='line-clamp-3 text-xs font-medium leading-tight'>{product.name}</p>
        <p className='text-base font-semibold'>
          R$ {maskedFromCents(product.sale_price_cents || 0)}
        </p>
        <div className='mt-auto space-y-1'>
          <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
            <Package className={cn('h-3 w-3 shrink-0', stockLow ? 'text-destructive' : 'text-muted-foreground')} />
            <span className={cn('min-w-0 truncate text-left font-medium', stockLow ? 'text-destructive' : 'text-foreground')}>
              {product.stock}
            </span>
          </div>
          <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
            <Hash className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate text-left font-medium'>{product.sku || '—'}</span>
          </div>
          <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
            <Barcode className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate text-left font-medium'>{product.barcode || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PdvClient ({ sellerName }: PdvClientProps) {
  const [loadingCash, setLoadingCash] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [showOpenCashModal, setShowOpenCashModal] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [activeTab, setActiveTab] = useState('produto')

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [topProducts, setTopProducts] = useState<CatalogProduct[]>([])
  const [loadingTopProducts, setLoadingTopProducts] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)

  const [insertQty, setInsertQty] = useState(1)
  const [insertUnitPriceMasked, setInsertUnitPriceMasked] = useState('')
  const [itemDiscountMasked, setItemDiscountMasked] = useState('')
  const [itemDiscountMode, setItemDiscountMode] = useState<'fixed' | 'percent'>('fixed')
  const [editingCartLineId, setEditingCartLineId] = useState<string | null>(null)

  const [cart, setCart] = useState<CartItem[]>([])
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [currentOrderNumber, setCurrentOrderNumber] = useState<number | null>(null)
  const [sessionOrders, setSessionOrders] = useState<OrderSummary[]>([])

  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [customerType, setCustomerType] = useState<'pf' | 'pj'>('pf')
  const [customerDocument, setCustomerDocument] = useState('')

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<PaymentLine[]>([])
  const [discountTotalMasked, setDiscountTotalMasked] = useState('')
  const [cashReceivedMasked, setCashReceivedMasked] = useState('')

  const [sangriaOpen, setSangriaOpen] = useState(false)
  const [suprimentoOpen, setSuprimentoOpen] = useState(false)
  const [closeCashOpen, setCloseCashOpen] = useState(false)
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [closeSummary, setCloseSummary] = useState<CashCloseSummary | null>(null)
  const [loadingCloseSummary, setLoadingCloseSummary] = useState(false)
  const [closeCountedCash, setCloseCountedCash] = useState('')
  const [closeCountedByMethod, setCloseCountedByMethod] = useState<Partial<Record<PaymentMethodType, string>>>({})

  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const discountTotalCents = moneyToCentsFromMasked(discountTotalMasked) || 0

  const subtotalCents = useMemo(() => cart.reduce((acc, item) => {
    const raw = item.quantity * item.unitPriceCents
    return acc + Math.max(0, raw - item.discountCents)
  }, 0), [cart])

  const totalCents = Math.max(0, subtotalCents - discountTotalCents)
  const paidCents = useMemo(() => payments.reduce((acc, p) => acc + (moneyToCentsFromMasked(p.amountMasked) || 0), 0), [payments])
  const hasCashPayment = payments.some((p) => p.payment_method_type === 'dinheiro')
  const cashPaidCents = useMemo(() => payments
    .filter((p) => p.payment_method_type === 'dinheiro')
    .reduce((acc, p) => acc + (moneyToCentsFromMasked(p.amountMasked) || 0), 0), [payments])
  const changeCents = useMemo(() => {
    if (!hasCashPayment || cashPaidCents <= 0) return 0
    const received = moneyToCentsFromMasked(cashReceivedMasked)
    if (received == null || received <= 0) return 0
    return Math.max(0, received - cashPaidCents)
  }, [hasCashPayment, cashPaidCents, cashReceivedMasked])

  const insertUnitCents = useMemo(() => {
    if (!selectedProduct) return 0
    const fromMask = moneyToCentsFromMasked(insertUnitPriceMasked)
    if (fromMask != null && fromMask > 0) return fromMask
    return Number(selectedProduct.sale_price_cents) || 0
  }, [selectedProduct, insertUnitPriceMasked])
  const insertDiscountCents = useMemo(() => {
    if (itemDiscountMode === 'percent') {
      const pct = Math.min(100, Math.max(0, Number(itemDiscountMasked.replace(',', '.')) || 0))
      const base = insertQty * insertUnitCents
      return Math.round(base * pct / 100)
    }
    return moneyToCentsFromMasked(itemDiscountMasked) || 0
  }, [itemDiscountMode, itemDiscountMasked, insertQty, insertUnitCents])

  const insertSubtotalCents = Math.max(0, insertQty * insertUnitCents - insertDiscountCents)

  const loadCash = useCallback(async () => {
    setLoadingCash(true)
    const res = await portalFetch('/api/portal/pdv/cash/current')
    const data = await res?.json().catch(() => null)
    const isOpen = Boolean(data?.ok && data?.session)
    setCashOpen(isOpen)
    setShowOpenCashModal(!isOpen)
    setLoadingCash(false)
  }, [])

  const loadSessionOrders = useCallback(async () => {
    const res = await portalFetch('/api/portal/sales-orders?current_cash=1')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.orders)) {
      setSessionOrders(data.orders)
    } else {
      setSessionOrders([])
    }
  }, [])

  const loadTopProducts = useCallback(async () => {
    setLoadingTopProducts(true)
    const res = await portalFetch('/api/portal/pdv/top-products')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.products)) {
      setTopProducts(data.products.map((row: Record<string, unknown>) => mapCatalogProduct(row)))
    } else {
      setTopProducts([])
    }
    setLoadingTopProducts(false)
  }, [])

  const loadMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  const searchProducts = useCallback(async (value: string) => {
    setLoadingProducts(true)
    const q = value.trim()
    const res = await portalFetch(`/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.products)) {
      setSearchResults(data.products.slice(0, 10).map((row: Record<string, unknown>) => mapCatalogProduct(row)))
      setShowSearchDropdown(q.length > 0)
    } else {
      setSearchResults([])
      setShowSearchDropdown(false)
    }
    setLoadingProducts(false)
  }, [])

  useEffect(() => {
    void loadCash()
    void loadTopProducts()
    void loadMethods()
  }, [loadCash, loadTopProducts, loadMethods])

  useEffect(() => {
    if (cashOpen) void loadSessionOrders()
  }, [cashOpen, loadSessionOrders])

  useEffect(() => {
    if (totalCents <= 0) {
      setPayments([])
      setCashReceivedMasked('')
      return
    }
    setPayments((prev) => {
      if (prev.length === 0) {
        if (paymentMethods.length === 0) return prev
        return [buildDefaultPaymentLine(totalCents, paymentMethods)]
      }
      if (prev.length === 1) {
        return [{ ...prev[0], amountMasked: maskedFromCents(totalCents) }]
      }
      return prev
    })
  }, [totalCents, paymentMethods])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (query.trim()) void searchProducts(query)
      else {
        setSearchResults([])
        setShowSearchDropdown(false)
      }
    }, 280)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchProducts])

  useEffect(() => {
    function onClickOutside (event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const buildOrderPayload = useCallback((cartItems?: CartItem[]) => {
    const source = cartItems ?? cart
    return {
      customer_name: customerName,
      customer_type: customerType,
      customer_document: customerDocument.replace(/\D/g, '') || null,
      discount_total_cents: discountTotalCents,
      items: source.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        unit_cost_cents: item.unitCostCents,
        discount_cents: item.discountCents,
      })),
    }
  }, [cart, customerName, customerType, customerDocument, discountTotalCents])

  const syncCurrentOrder = useCallback(async (
    silent = false,
    cartItems?: CartItem[],
    orderIdOverride?: string | null,
  ) => {
    const source = cartItems ?? cart
    if (!cashOpen || source.length === 0) return

    const payload = buildOrderPayload(source)
    const orderId = orderIdOverride !== undefined ? orderIdOverride : currentOrderId

    if (!orderId) {
      const res = await portalFetch('/api/portal/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.order_id) {
        setCurrentOrderId(data.order_id)
        setCurrentOrderNumber(data.order?.order_number ?? null)
        void loadSessionOrders()
      } else if (!silent) {
        toast({ title: data?.error || 'Erro ao salvar pedido', variant: 'destructive' })
      }
      return
    }

    const res = await portalFetch(`/api/portal/sales-orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      void loadSessionOrders()
    } else if (!silent) {
      toast({ title: data?.error || 'Erro ao atualizar pedido', variant: 'destructive' })
    }
  }, [buildOrderPayload, cart, cashOpen, currentOrderId, loadSessionOrders])

  useEffect(() => {
    if (!cashOpen || cart.length === 0) return
    if (!currentOrderId) return
    if (syncRef.current) clearTimeout(syncRef.current)
    syncRef.current = setTimeout(() => { void syncCurrentOrder(true) }, 400)
    return () => {
      if (syncRef.current) clearTimeout(syncRef.current)
    }
  }, [cart, currentOrderId, customerName, customerType, customerDocument, discountTotalCents, syncCurrentOrder, cashOpen])

  function resetDraft () {
    setCart([])
    setPayments([])
    setDiscountTotalMasked('')
    setCashReceivedMasked('')
    setCurrentOrderId(null)
    setCurrentOrderNumber(null)
    setCustomerName('Consumidor Final')
    setCustomerType('pf')
    setCustomerDocument('')
    setSelectedProduct(null)
    setInsertQty(1)
    setInsertUnitPriceMasked('')
    setItemDiscountMasked('')
    setEditingCartLineId(null)
  }

  function cancelCartLineEdit () {
    setEditingCartLineId(null)
    setSelectedProduct(null)
    setInsertQty(1)
    setInsertUnitPriceMasked('')
    setItemDiscountMasked('')
  }

  function selectProduct (product: CatalogProduct) {
    setEditingCartLineId(null)
    setSelectedProduct(product)
    setQuery('')
    setShowSearchDropdown(false)
    setInsertQty(1)
    setInsertUnitPriceMasked(maskedFromCents(product.sale_price_cents || 0))
    setItemDiscountMasked('')
  }

  function beginEditCartItem (lineId: string) {
    const item = cart.find((row) => row.lineId === lineId)
    if (!item) return

    setEditingCartLineId(lineId)
    setSelectedProduct({
      id: item.productId,
      name: item.name,
      sku: null,
      barcode: null,
      sale_price_cents: item.unitPriceCents,
      cost_price_cents: item.unitCostCents,
      image_url: null,
      stock: 0,
    })
    setInsertQty(item.quantity)
    setInsertUnitPriceMasked(maskedFromCents(item.unitPriceCents))
    setItemDiscountMode('fixed')
    setItemDiscountMasked(maskedFromCents(item.discountCents))
    setQuery('')
    setShowSearchDropdown(false)
    setActiveTab('produto')
  }

  async function insertItem () {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa antes de vender', variant: 'destructive' })
      return
    }
    if (!selectedProduct) {
      toast({ title: 'Selecione um produto', variant: 'destructive' })
      return
    }

    if (editingCartLineId) {
      const nextCart = cart.map((item) => (
        item.lineId === editingCartLineId
          ? {
              ...item,
              quantity: insertQty,
              unitPriceCents: insertUnitCents,
              discountCents: insertDiscountCents,
            }
          : item
      ))
      setCart(nextCart)
      cancelCartLineEdit()
      await syncCurrentOrder(Boolean(currentOrderId), nextCart)
      return
    }

    const newItem: CartItem = {
      lineId: createCartLineId(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      quantity: insertQty,
      unitPriceCents: insertUnitCents,
      unitCostCents: Number(selectedProduct.cost_price_cents) || 0,
      discountCents: insertDiscountCents,
    }

    const nextCart = mergeCartItem(cart, newItem)
    setCart(nextCart)
    setItemDiscountMasked('')
    setInsertQty(1)

    await syncCurrentOrder(Boolean(currentOrderId), nextCart)
  }

  function updateCartItem (lineId: string, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((item) => item.lineId === lineId ? { ...item, ...patch } : item))
  }

  function removeCartItem (lineId: string) {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId))
  }

  async function loadOrderIntoCart (orderId: string) {
    const res = await portalFetch(`/api/portal/sales-orders/${orderId}`)
    const data = await res?.json().catch(() => null)
    if (!data?.ok) {
      toast({ title: 'Erro ao carregar pedido', variant: 'destructive' })
      return
    }
    if (data.order.status !== 'in_progress') return

    setCurrentOrderId(data.order.id)
    setCurrentOrderNumber(data.order.order_number)
    setCustomerName(data.order.customer_name || 'Consumidor Final')
    setCustomerType(fromDbCustomerType(data.order.customer_type))
    setCustomerDocument(data.order.customer_document || '')
    setDiscountTotalMasked(maskedFromCents(data.order.discount_total_cents || 0))

    const items: CartItem[] = (data.items ?? []).map((row: {
      id: string
      product_id: string
      quantity: number
      unit_price_cents: number
      unit_cost_cents: number
      discount_cents: number
      products?: { name?: string } | null
    }) => ({
      lineId: String(row.id),
      productId: String(row.product_id),
      name: row.products?.name || 'Produto',
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      unitCostCents: row.unit_cost_cents || 0,
      discountCents: row.discount_cents || 0,
    }))
    setCart(items)
    setEditingCartLineId(null)
    setSelectedProduct(null)
    setInsertQty(1)
    setInsertUnitPriceMasked('')
    setItemDiscountMasked('')

    const payLines: PaymentLine[] = (data.payments ?? []).map((p: {
      payment_method_id?: string | null
      payment_method_type: PaymentLine['payment_method_type']
      amount_cents: number
    }) => ({
      payment_method_id: p.payment_method_id ?? null,
      payment_method_type: p.payment_method_type,
      amountMasked: maskedFromCents(p.amount_cents),
    }))
    setPayments(payLines)
  }

  async function openCash () {
    const cents = moneyToCentsFromMasked(openingAmount) || 0
    setBusy(true)
    const res = await portalFetch('/api/portal/pdv/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_amount_cents: cents }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      setCashOpen(true)
      setShowOpenCashModal(false)
      setOpeningAmount('')
      toast({ title: 'Caixa aberto com sucesso' })
      void loadSessionOrders()
      return
    }
    toast({ title: data?.error || 'Erro ao abrir caixa', variant: 'destructive' })
  }

  async function submitMovement (type: 'sangria' | 'suprimento') {
    const cents = moneyToCentsFromMasked(movementAmount) || 0
    if (cents <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' })
      return
    }
    setBusy(true)
    const res = await portalFetch('/api/portal/pdv/cash/movement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount_cents: cents, reason: movementReason || null }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      setMovementAmount('')
      setMovementReason('')
      setSangriaOpen(false)
      setSuprimentoOpen(false)
      toast({ title: type === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado' })
      return
    }
    toast({ title: data?.error || 'Erro ao registrar movimento', variant: 'destructive' })
  }

  const loadCloseSummary = useCallback(async () => {
    setLoadingCloseSummary(true)
    const res = await portalFetch('/api/portal/pdv/cash/close-summary')
    const data = await res?.json().catch(() => null)
    if (data?.ok && data.summary) {
      setCloseSummary(data.summary)
    } else {
      setCloseSummary(null)
      if (data?.error === 'cash_not_open') {
        setCloseCashOpen(false)
      } else {
        toast({ title: 'Erro ao carregar resumo do caixa', variant: 'destructive' })
      }
    }
    setLoadingCloseSummary(false)
  }, [])

  useEffect(() => {
    if (!closeCashOpen) return
    setCloseCountedCash('')
    setCloseCountedByMethod({})
    void loadCloseSummary()
  }, [closeCashOpen, loadCloseSummary])

  function setCloseCountedMethod (type: PaymentMethodType, masked: string) {
    setCloseCountedByMethod((prev) => ({ ...prev, [type]: masked }))
  }

  function getCloseMethodDifferenceCents (type: PaymentMethodType) {
    if (!closeSummary) return null
    const counted = moneyToCentsFromMasked(closeCountedByMethod[type] || '') ?? 0
    if (!closeCountedByMethod[type]?.trim()) return null
    return counted - closeSummary.by_method[type]
  }

  const closeCashDifferenceCents = useMemo(() => {
    if (!closeSummary) return null
    if (!closeCountedCash.trim()) return null
    const counted = moneyToCentsFromMasked(closeCountedCash) ?? 0
    return counted - closeSummary.expected_cash_cents
  }, [closeSummary, closeCountedCash])

  async function closeCash () {
    if (!closeSummary) {
      toast({ title: 'Aguarde o resumo do caixa', variant: 'destructive' })
      return
    }

    if (!closeCountedCash.trim()) {
      toast({ title: 'Informe o valor atual do caixa', variant: 'destructive' })
      return
    }

    const nonCashMethods = closeSummary.methods_used.filter((type) => type !== 'dinheiro')
    for (const type of nonCashMethods) {
      if (!closeCountedByMethod[type]?.trim()) {
        toast({
          title: `Informe o valor conferido em ${PAYMENT_METHOD_LABELS[type]}`,
          variant: 'destructive',
        })
        return
      }
    }

    const countedCashCents = moneyToCentsFromMasked(closeCountedCash) ?? 0
    const countedByMethod: Partial<Record<PaymentMethodType, number>> = {}
    for (const type of closeSummary.methods_used) {
      if (type === 'dinheiro') continue
      countedByMethod[type] = moneyToCentsFromMasked(closeCountedByMethod[type] || '') ?? 0
    }

    setBusy(true)
    const res = await portalFetch('/api/portal/pdv/cash/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counted_cash_cents: countedCashCents, counted_by_method: countedByMethod }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      setCashOpen(false)
      setCloseCashOpen(false)
      setCloseSummary(null)
      setCloseCountedCash('')
      setCloseCountedByMethod({})
      resetDraft()
      setSessionOrders([])
      toast({ title: 'Caixa fechado com sucesso' })
      return
    }
    toast({ title: data?.error || 'Erro ao fechar caixa', variant: 'destructive' })
  }

  function addPaymentLine (method?: PaymentMethod) {
    setPayments((prev) => [...prev, {
      payment_method_id: method?.id ?? null,
      payment_method_type: method ? normalizePaymentType(method.type) : 'dinheiro',
      amountMasked: '',
    }])
  }

  function setPaymentLine (idx: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((line, index) => index === idx ? { ...line, ...patch } : line))
  }

  function removePaymentLine (idx: number) {
    setPayments((prev) => {
      const next = prev.filter((_, index) => index !== idx)
      if (next.length === 0 && totalCents > 0 && paymentMethods.length > 0) {
        return [buildDefaultPaymentLine(totalCents, paymentMethods)]
      }
      return next
    })
  }

  async function saveOrder () {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'Adicione itens ao carrinho', variant: 'destructive' })
      return
    }
    setBusy(true)
    await syncCurrentOrder()
    setBusy(false)
    toast({ title: 'Pedido salvo' })
  }

  async function cancelCurrentOrder () {
    if (!currentOrderId) {
      resetDraft()
      return
    }
    setBusy(true)
    const res = await portalFetch(`/api/portal/sales-orders/${currentOrderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelado no PDV' }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      resetDraft()
      void loadSessionOrders()
      toast({ title: 'Pedido cancelado' })
      return
    }
    toast({ title: data?.error || 'Erro ao cancelar', variant: 'destructive' })
  }

  async function finalizeOrder () {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa antes de vender', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'Adicione itens no carrinho', variant: 'destructive' })
      return
    }
    if (paidCents < totalCents) {
      toast({ title: 'Pagamento insuficiente', variant: 'destructive' })
      return
    }

    const hasPaymentWithoutMethod = payments.some((line) => {
      const amount = moneyToCentsFromMasked(line.amountMasked) || 0
      return amount > 0 && !line.payment_method_id
    })
    if (hasPaymentWithoutMethod) {
      toast({
        title: 'Selecione a forma de pagamento em cada linha',
        description: 'É necessário vincular a carteira no financeiro para lançar a movimentação.',
        variant: 'destructive',
      })
      return
    }

    setBusy(true)
    await syncCurrentOrder(true)

    let finalOrderId = currentOrderId
    if (!finalOrderId) {
      const createRes = await portalFetch('/api/portal/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrderPayload()),
      })
      const createData = await createRes?.json().catch(() => null)
      if (!createData?.ok || !createData.order_id) {
        setBusy(false)
        toast({ title: createData?.error || 'Erro ao criar pedido', variant: 'destructive' })
        return
      }
      finalOrderId = createData.order_id
      setCurrentOrderId(createData.order_id)
      setCurrentOrderNumber(createData.order?.order_number ?? null)
    }

    await portalFetch(`/api/portal/sales-orders/${finalOrderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOrderPayload()),
    })

    const paymentPayload = payments.map((line) => ({
      payment_method_id: line.payment_method_id ?? null,
      payment_method_type: line.payment_method_type,
      amount_cents: moneyToCentsFromMasked(line.amountMasked) || 0,
      status: 'paid',
    })).filter((line) => line.amount_cents > 0)

    const payRes = await portalFetch(`/api/portal/sales-orders/${finalOrderId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments: paymentPayload }),
    })
    const payData = await payRes?.json().catch(() => null)
    if (!payData?.ok) {
      setBusy(false)
      toast({ title: payData?.error || 'Erro ao lançar pagamento', variant: 'destructive' })
      return
    }

    const finalizeRes = await portalFetch(`/api/portal/sales-orders/${finalOrderId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change_cents: changeCents }),
    })
    const finalizeData = await finalizeRes?.json().catch(() => null)
    setBusy(false)

    if (!finalizeData?.ok) {
      const errorTitle = finalizeData?.error === 'finance_sync_failed'
        ? 'Venda paga, mas não foi possível lançar no financeiro'
        : finalizeData?.error === 'db_error'
          ? 'Erro ao finalizar'
          : (finalizeData?.error || 'Erro ao finalizar')
      const errorDescription = finalizeData?.error === 'finance_sync_failed'
        ? 'Vincule cada forma de pagamento a uma carteira em Financeiro > Formas de pagamento.'
        : undefined
      toast({ title: errorTitle, description: errorDescription, variant: 'destructive' })
      return
    }

    toast({ title: `Pedido #${finalizeData.order.order_number} finalizado` })
    resetDraft()
    void loadSessionOrders()
    void loadTopProducts()
  }

  useEffect(() => {
    function onKeyDown (event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setActiveTab('produto')
      }
      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        setActiveTab('cliente')
      }
      if (event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setActiveTab('pagamento')
      }
      if (event.key === 'F2') {
        event.preventDefault()
        document.getElementById('pdv-search')?.focus()
      }
      if (event.key === 'F6') {
        event.preventDefault()
        void finalizeOrder()
      }
      if (event.key === 'Escape') {
        setQuery('')
        setShowSearchDropdown(false)
      }
      if (event.ctrlKey && event.key === 'Backspace') {
        event.preventDefault()
        void cancelCurrentOrder()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const sortedOrders = sortOrders(sessionOrders)

  return (
    <div className='flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm'>
      <header className='flex shrink-0 items-center justify-between rounded-t-xl border-b bg-primary px-4 py-2 text-primary-foreground'>
        <div className='flex items-center gap-4'>
          <h1 className='text-lg font-semibold'>Frente de Caixa</h1>
          <span className='text-sm opacity-90'>Vendedor: {sellerName}</span>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            size='sm'
            onClick={() => resetDraft()}
            disabled={!cashOpen}
          >
            Nova venda
          </Button>
          <Link href='/portal/pedidos-venda'>
            <Button variant='secondary' size='sm'>Pedidos</Button>
          </Link>
          {cashOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='secondary' size='icon' className='h-8 w-8' aria-label='Menu caixa'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setSangriaOpen(true)}>Sangria</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSuprimentoOpen(true)}>Suprimento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloseCashOpen(true)}>Fechar caixa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <div className='grid min-h-0 flex-1 grid-cols-12 gap-0 overflow-hidden rounded-b-xl'>
        {/* Produto + carrinho + ações da venda */}
        <div className='col-span-10 flex min-h-0 flex-col overflow-hidden border-r'>
          <div className='grid min-h-0 flex-1 grid-cols-2'>
            {/* Coluna esquerda — abas */}
            <div className='flex flex-col overflow-hidden border-r'>
          <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-1 flex-col overflow-hidden'>
            <TabsList className='mx-3 mt-3 grid w-auto grid-cols-3'>
              <TabsTrigger value='produto'>Produto</TabsTrigger>
              <TabsTrigger value='cliente'>Cliente</TabsTrigger>
              <TabsTrigger value='pagamento'>Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value='produto' className='flex min-h-0 flex-1 flex-col overflow-hidden p-4 data-[state=inactive]:hidden'>
              <div className='mb-3 shrink-0'>
                <Label className='text-xs text-muted-foreground'>Mais vendidos</Label>
                {loadingTopProducts ? (
                  <div className='mt-1 flex h-16 items-center justify-center rounded-md border border-dashed bg-muted/30'>
                    <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                  </div>
                ) : topProducts.length === 0 ? (
                  <p className='mt-1 text-xs text-muted-foreground'>Nenhum produto cadastrado</p>
                ) : (
                  <div className='mt-1 grid grid-cols-5 gap-1'>
                    {topProducts.map((product, index) => (
                      <button
                        key={product.id}
                        type='button'
                        title={product.name}
                        onClick={() => selectProduct(product)}
                        className={cn(
                          'relative h-16 overflow-hidden rounded-md border text-left hover:opacity-90',
                          selectedProduct?.id === product.id && 'border-primary ring-2 ring-primary',
                        )}
                      >
                        {product.image_url && isSafeProductListImageUrl(product.image_url) ? (
                          <ProductThumbImage
                            src={product.image_url}
                            alt={product.name}
                            eager={index < 5}
                          />
                        ) : (
                          <div className='flex h-full items-center justify-center bg-muted'>
                            <Package className='h-5 w-5 text-muted-foreground/50' />
                          </div>
                        )}
                        <div className='absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5'>
                          <div className='truncate text-[9px] font-medium leading-tight text-white'>{product.name}</div>
                          <div className='text-[9px] text-white/80'>{maskedFromCents(product.sale_price_cents || 0)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={searchRef} className='relative mb-3 shrink-0'>
                <div className={inputGroupShell}>
                  <span className='flex w-9 shrink-0 items-center justify-center border-r border-input text-muted-foreground'>
                    {loadingProducts ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
                  </span>
                  <input
                    id='pdv-search'
                    type='text'
                    placeholder='Buscar produto (F2)'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setShowSearchDropdown(true)}
                    className='min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground'
                  />
                </div>
                {showSearchDropdown && searchResults.length > 0 ? (
                  <div className='absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md'>
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        type='button'
                        className='block w-full px-3 py-2 text-left text-sm hover:bg-accent'
                        onClick={() => selectProduct(product)}
                      >
                        <div className='font-medium'>{product.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {product.sku || '—'} · Est: {product.stock} · {maskedFromCents(product.sale_price_cents || 0)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {showSearchDropdown && query.trim() && !loadingProducts && searchResults.length === 0 ? (
                  <div className='absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md'>
                    Nenhum produto encontrado
                  </div>
                ) : null}
              </div>

              <div className='mb-3 flex min-h-0 flex-1 flex-col'>
                <ProductPreview product={selectedProduct} />
              </div>

              <div className='grid shrink-0 grid-cols-2 items-end gap-2 md:flex md:flex-wrap'>
                <div className={insertFormFieldClass}>
                  <Label className='text-xs'>Quantidade</Label>
                  <div className='mt-1 w-full'>
                    <QuantityStepper
                      value={insertQty}
                      onChange={setInsertQty}
                      disabled={!selectedProduct}
                    />
                  </div>
                </div>
                <div className={insertFormFieldClass}>
                  <Label className='text-xs'>Desconto</Label>
                  <div className='mt-1 w-full'>
                    <DiscountField
                      value={itemDiscountMasked}
                      onChange={setItemDiscountMasked}
                      mode={itemDiscountMode}
                      onModeToggle={() => {
                        setItemDiscountMode((m) => m === 'fixed' ? 'percent' : 'fixed')
                        setItemDiscountMasked('')
                      }}
                      disabled={!selectedProduct}
                    />
                  </div>
                </div>
                <div className={insertFormFieldClass}>
                  <Label className='text-xs'>Valor</Label>
                  <Input
                    value={insertUnitPriceMasked}
                    onChange={(e) => setInsertUnitPriceMasked(formatMoneyInput(e.target.value))}
                    disabled={!selectedProduct}
                    className='mt-1 h-9 w-full min-w-0 px-2 text-xs'
                    placeholder='0,00'
                  />
                </div>
                <div className={insertFormFieldClass}>
                  <Label className='text-xs'>Subtotal</Label>
                  <Input readOnly value={maskedFromCents(insertSubtotalCents)} className='mt-1 h-9 w-full min-w-0 bg-muted px-2 text-xs' tabIndex={-1} />
                </div>
                {editingCartLineId ? (
                  <Button
                    type='button'
                    variant='outline'
                    className='col-span-2 h-9 w-full px-3 md:col-auto md:w-auto md:flex-[0_0_auto]'
                    onClick={cancelCartLineEdit}
                  >
                    Cancelar
                  </Button>
                ) : null}
                <Button
                  className={cn(
                    'h-9 w-full px-3 md:w-auto md:flex-[0_0_auto]',
                    editingCartLineId ? 'col-span-2 md:col-auto' : 'col-span-2 md:col-auto',
                  )}
                  onClick={() => void insertItem()}
                  disabled={!selectedProduct || !cashOpen}
                >
                  {editingCartLineId ? 'Salvar' : 'Inserir'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='cliente' className='flex-1 overflow-auto p-4 data-[state=inactive]:hidden'>
              <div className='space-y-3'>
                <div>
                  <Label>Nome</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select
                    className='mt-1 flex h-10 w-full rounded-md border bg-background px-3 text-sm'
                    value={customerType}
                    onChange={(e) => {
                      setCustomerType(e.target.value === 'pj' ? 'pj' : 'pf')
                      setCustomerDocument('')
                    }}
                  >
                    <option value='pf'>Pessoa Física</option>
                    <option value='pj'>Pessoa Jurídica</option>
                  </select>
                </div>
                <div>
                  <Label>{customerType === 'pj' ? 'CNPJ' : 'CPF'}</Label>
                  <Input
                    value={customerDocument}
                    onChange={(e) => setCustomerDocument(
                      customerType === 'pj' ? formatCnpj(e.target.value) : formatCpf(e.target.value),
                    )}
                    placeholder={customerType === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value='pagamento' className='flex-1 overflow-auto p-4 data-[state=inactive]:hidden'>
              <div className='space-y-3'>
                <div className='flex justify-end'>
                  <Button variant='outline' size='sm' onClick={() => void saveOrder()} disabled={busy || !cashOpen || cart.length === 0}>
                    Salvar pedido
                  </Button>
                </div>
                <div className='space-y-1 rounded border p-3 text-sm'>
                  <div className='flex justify-between'><span>Subtotal</span><strong>{maskedFromCents(subtotalCents)}</strong></div>
                  <div className='flex justify-between'><span>Desconto na compra</span><strong>- {maskedFromCents(discountTotalCents)}</strong></div>
                  <div className='flex justify-between text-base'><span>Total</span><strong>{maskedFromCents(totalCents)}</strong></div>
                </div>
                <div>
                  <Label>Desconto na compra</Label>
                  <Input
                    value={discountTotalMasked}
                    onChange={(e) => setDiscountTotalMasked(formatMoneyInput(e.target.value))}
                    placeholder='0,00'
                  />
                </div>
                {hasCashPayment ? (
                  <div>
                    <Label>Recebido em dinheiro</Label>
                    <Input
                      className='mt-1'
                      value={cashReceivedMasked}
                      onChange={(e) => setCashReceivedMasked(formatMoneyInput(e.target.value))}
                      placeholder='0,00'
                    />
                  </div>
                ) : null}
                <div className='space-y-2'>
                  <Button variant='outline' size='sm' onClick={() => addPaymentLine()}>Adicionar pagamento</Button>
                  {payments.map((line, idx) => (
                    <div key={`${idx}-${line.payment_method_type}`} className='grid gap-1'>
                      <select
                        className='h-9 rounded border bg-background px-2 text-sm'
                        value={line.payment_method_id || ''}
                        onChange={(e) => {
                          const id = e.target.value || null
                          const method = paymentMethods.find((m) => m.id === id)
                          const nextType = method ? normalizePaymentType(method.type) : line.payment_method_type
                          setPayments((prev) => {
                            const next = prev.map((row, index) => (
                              index === idx
                                ? { ...row, payment_method_id: id, payment_method_type: nextType }
                                : row
                            ))
                            if (!next.some((p) => p.payment_method_type === 'dinheiro')) {
                              setCashReceivedMasked('')
                            }
                            return next
                          })
                        }}
                      >
                        <option value='' disabled>Selecione…</option>
                        {paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>{method.description}</option>
                        ))}
                      </select>
                      <div className='flex gap-1'>
                        <Input
                          value={line.amountMasked}
                          onChange={(e) => setPaymentLine(idx, { amountMasked: formatMoneyInput(e.target.value) })}
                          placeholder='0,00'
                        />
                        <Button variant='ghost' size='icon' onClick={() => removePaymentLine(idx)}>
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className='space-y-1 rounded border p-3 text-sm'>
                  <div className='flex justify-between'><span>Pago</span><strong>{maskedFromCents(paidCents)}</strong></div>
                  <div className='flex justify-between'><span>Troco</span><strong>{maskedFromCents(changeCents)}</strong></div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
            </div>

            {/* Coluna centro — carrinho */}
            <div className='flex min-h-0 flex-col overflow-hidden'>
          <div className={cn(pdvColumnHeaderClass, 'justify-between')}>
            <h2 className={pdvColumnTitleClass}>
              Carrinho
              {currentOrderNumber ? ` · Pedido #${currentOrderNumber}` : ''}
            </h2>
          </div>

          <div className='min-h-0 flex-1 overflow-auto'>
            {cart.length === 0 ? (
              <p className='py-12 text-center text-sm text-muted-foreground'>Nenhum item no carrinho</p>
            ) : (
              <table className='w-full table-fixed text-sm'>
                <thead className='sticky top-0 z-10 border-b bg-muted/70'>
                  <tr className='text-left text-xs font-medium text-muted-foreground'>
                    <th className='px-3 py-2.5'>Produto</th>
                    <th className='w-11 px-1 py-2.5 text-center'>Qtde.</th>
                    <th className='w-[5.5rem] px-2 py-2.5 text-right'>Preço</th>
                    <th className='w-[6rem] px-2 py-2.5 text-right'>Sub Total</th>
                    <th className='w-[4.5rem] px-2 py-2.5 text-center'>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr
                      key={item.lineId}
                      className={cn(
                        'border-b border-border/80 align-middle hover:bg-muted/30',
                        item.lineId === editingCartLineId && 'bg-primary/5 ring-1 ring-inset ring-primary/25',
                      )}
                    >
                      <td className='px-3 py-2.5 align-middle'>
                        <div className='text-xs font-medium leading-snug break-words whitespace-normal'>
                          {item.name}
                        </div>
                        {item.discountCents > 0 ? (
                          <div className='mt-0.5 text-[11px] leading-snug text-muted-foreground'>
                            Desc. − {maskedFromCents(item.discountCents)}
                          </div>
                        ) : null}
                      </td>
                      <td className='px-1 py-2 text-center'>
                        <Input
                          type='number'
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateCartItem(item.lineId, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                          className='mx-auto h-8 w-10 min-w-0 border-transparent bg-transparent px-0.5 text-center text-xs shadow-none focus-visible:border-input focus-visible:bg-background'
                        />
                      </td>
                      <td className='px-2 py-2.5 text-right tabular-nums'>
                        {maskedFromCents(item.unitPriceCents)}
                      </td>
                      <td className='px-2 py-2.5 text-right font-medium tabular-nums'>
                        {maskedFromCents(cartLineSubtotalCents(item))}
                      </td>
                      <td className='px-1 py-2 text-center'>
                        <div className='flex items-center justify-center gap-0'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => beginEditCartItem(item.lineId)}
                            aria-label='Editar item'
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => {
                              if (editingCartLineId === item.lineId) cancelCartLineEdit()
                              removeCartItem(item.lineId)
                            }}
                            aria-label='Remover item'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className='shrink-0 border-t'>
            <div className='flex items-center justify-between bg-primary/10 px-4 py-3'>
              <span className='text-sm font-medium text-foreground'>Total</span>
              <span className='text-2xl font-bold tabular-nums text-primary'>
                {maskedFromCents(totalCents)}
              </span>
            </div>
          </div>
            </div>
          </div>

          <div className='flex shrink-0 justify-end gap-2 border-t bg-muted/40 px-4 py-2.5'>
            <Button
              variant='outline'
              onClick={() => void cancelCurrentOrder()}
              disabled={busy || (!currentOrderId && cart.length === 0)}
            >
              Excluir venda
            </Button>
            <Button onClick={() => void finalizeOrder()} disabled={busy || !cashOpen || cart.length === 0}>
              {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              Finalizar venda (F6)
            </Button>
          </div>
        </div>

        {/* Coluna direita — últimos pedidos */}
        <div className='col-span-2 flex min-w-0 flex-col overflow-hidden bg-muted/20'>
          <div className={pdvColumnHeaderClass}>
            <h2 className={pdvColumnTitleClass}>Últimos pedidos</h2>
          </div>
          <div className='flex-1 overflow-auto px-4 py-1.5'>
            {sortedOrders.length === 0 ? (
              <p className='py-6 text-center text-[10px] text-muted-foreground'>Nenhum pedido</p>
            ) : (
              <div className='space-y-1'>
                {sortedOrders.map((order) => {
                  const isActive = order.status === 'in_progress'
                  return (
                    <button
                      key={order.id}
                      type='button'
                      disabled={!isActive}
                      onClick={() => void loadOrderIntoCart(order.id)}
                      className={cn(
                        'w-full rounded-md border px-4 py-1.5 text-left transition-colors',
                        isActive && 'cursor-pointer border-border bg-background hover:bg-accent',
                        !isActive && 'cursor-default border-transparent bg-muted/40 text-muted-foreground',
                        isActive && currentOrderId === order.id && 'border-primary ring-2 ring-primary/30',
                      )}
                    >
                      <div className='flex flex-col gap-0.5'>
                        <span className={cn('font-semibold leading-none', isActive ? 'text-sm' : 'text-xs')}>
                          Pedido {order.order_number}
                        </span>
                        <span className={cn('text-[11px] tabular-nums leading-none', isActive ? 'font-medium' : 'opacity-80')}>
                          {maskedFromCents(order.total_cents)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal abrir caixa — não dismissable */}
      <Dialog open={showOpenCashModal && !loadingCash} onOpenChange={() => {}}>
        <DialogContent aria-describedby={undefined} className='sm:max-w-md' onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div>
              <Label>Valor em dinheiro no caixa</Label>
              <Input
                value={openingAmount}
                onChange={(e) => setOpeningAmount(formatMoneyInput(e.target.value))}
                placeholder='0,00'
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void openCash()} disabled={busy}>
              {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              Abrir caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sangria */}
      <Dialog open={sangriaOpen} onOpenChange={setSangriaOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Sangria</DialogTitle></DialogHeader>
          <div className='space-y-3'>
            <div>
              <Label>Valor</Label>
              <Input value={movementAmount} onChange={(e) => setMovementAmount(formatMoneyInput(e.target.value))} placeholder='0,00' />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void submitMovement('sangria')} disabled={busy}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suprimento */}
      <Dialog open={suprimentoOpen} onOpenChange={setSuprimentoOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Suprimento</DialogTitle></DialogHeader>
          <div className='space-y-3'>
            <div>
              <Label>Valor</Label>
              <Input value={movementAmount} onChange={(e) => setMovementAmount(formatMoneyInput(e.target.value))} placeholder='0,00' />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void submitMovement('suprimento')} disabled={busy}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fechar caixa */}
      <Dialog open={closeCashOpen} onOpenChange={setCloseCashOpen}>
        <DialogContent aria-describedby={undefined} className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Fechar caixa</DialogTitle>
          </DialogHeader>

          {loadingCloseSummary ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : closeSummary ? (
            <div className='space-y-4 py-1'>
              <div className='space-y-2 rounded-lg border bg-muted/30 p-3 text-sm'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Resumo da sessão</p>
                <div className='flex justify-between gap-2'>
                  <span className='text-muted-foreground'>Caixa aberto com</span>
                  <strong>{maskedFromCents(closeSummary.opening_amount_cents)}</strong>
                </div>
                <div className='flex justify-between gap-2'>
                  <span className='text-muted-foreground'>Sangrias</span>
                  <strong className='text-destructive'>− {maskedFromCents(closeSummary.sangrias_cents)}</strong>
                </div>
                {closeSummary.suprimentos_cents > 0 ? (
                  <div className='flex justify-between gap-2'>
                    <span className='text-muted-foreground'>Suprimentos</span>
                    <strong>+ {maskedFromCents(closeSummary.suprimentos_cents)}</strong>
                  </div>
                ) : null}
                {closeSummary.total_change_cents > 0 ? (
                  <div className='flex justify-between gap-2'>
                    <span className='text-muted-foreground'>Troco concedido</span>
                    <strong className='text-destructive'>− {maskedFromCents(closeSummary.total_change_cents)}</strong>
                  </div>
                ) : null}
                <div className='border-t pt-2'>
                  <p className='mb-1.5 text-xs text-muted-foreground'>Recebido no sistema por forma de pagamento</p>
                  {closeSummary.methods_used.length === 0 ? (
                    <p className='text-xs text-muted-foreground'>Nenhuma venda finalizada nesta sessão</p>
                  ) : (
                    <ul className='space-y-1'>
                      {closeSummary.methods_used.map((type) => (
                        <li key={type} className='flex justify-between gap-2'>
                          <span>{PAYMENT_METHOD_LABELS[type]}</span>
                          <strong>{maskedFromCents(closeSummary.by_method[type])}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className='flex justify-between gap-2 border-t pt-2'>
                  <span className='font-medium'>Dinheiro esperado no caixa</span>
                  <strong>{maskedFromCents(closeSummary.expected_cash_cents)}</strong>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {closeSummary.paid_orders_count} venda(s) finalizada(s) nesta sessão
                </p>
              </div>

              <div className='space-y-3'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Conferência</p>
                <div>
                  <Label>Valor atual do caixa</Label>
                  <Input
                    value={closeCountedCash}
                    onChange={(e) => setCloseCountedCash(formatMoneyInput(e.target.value))}
                    placeholder='0,00'
                    className='mt-1'
                  />
                  {closeCashDifferenceCents != null ? (
                    <p className={cn(
                      'mt-1 text-xs',
                      closeCashDifferenceCents === 0 ? 'text-muted-foreground' : closeCashDifferenceCents > 0 ? 'text-green-700' : 'text-destructive',
                    )}
                    >
                      Diferença no caixa: {closeCashDifferenceCents >= 0 ? '+' : '−'} {maskedFromCents(Math.abs(closeCashDifferenceCents))}
                    </p>
                  ) : null}
                </div>

                {closeSummary.methods_used
                  .filter((type) => type !== 'dinheiro')
                  .map((type) => {
                    const diff = getCloseMethodDifferenceCents(type)
                    return (
                      <div key={type}>
                        <Label>Valor conferido em {PAYMENT_METHOD_LABELS[type]}</Label>
                        <p className='text-xs text-muted-foreground'>
                          Sistema: {maskedFromCents(closeSummary.by_method[type])}
                        </p>
                        <Input
                          value={closeCountedByMethod[type] || ''}
                          onChange={(e) => setCloseCountedMethod(type, formatMoneyInput(e.target.value))}
                          placeholder='0,00'
                          className='mt-1'
                        />
                        {diff != null ? (
                          <p className={cn(
                            'mt-1 text-xs',
                            diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-green-700' : 'text-destructive',
                          )}
                          >
                            Diferença: {diff >= 0 ? '+' : '−'} {maskedFromCents(Math.abs(diff))}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <p className='py-6 text-center text-sm text-muted-foreground'>Não foi possível carregar o resumo</p>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setCloseCashOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={() => void closeCash()}
              disabled={busy || loadingCloseSummary || !closeSummary}
            >
              {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              Fechar caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
