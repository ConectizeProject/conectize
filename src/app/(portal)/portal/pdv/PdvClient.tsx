'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Barcode,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
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
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { toast } from '@/hooks/use-toast'
import { appConfirm, appPrompt } from '@/lib/ui/app-dialogs'
import { cn } from '@/lib/utils'
import {
  PAYMENT_METHOD_LABELS,
  type CashCloseSummary,
  type PaymentMethodType,
} from '@/lib/pdv/cash-close-summary'
import { salesOrderCupomPrintLabel } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'
import {
  isProductFiscalCorrectionError,
  nfceEditorHref,
} from '@/lib/fiscal/product-fiscal-errors'
import type {
  CartItem,
  CatalogProduct,
  OrderSummary,
  PaymentLine,
  PaymentMethod,
  PdvClientProps,
  PdvCustomerMatch,
} from './pdv-types'
import {
  buildDefaultPaymentLine,
  cartLineSubtotalCents,
  clampPaymentLineAmount,
  createCartLineId,
  customerTypeFromDocument,
  isCatalogService,
  isLikelyBarcode,
  mapCatalogProduct,
  maxCreditInstallments,
  mergeCartItem,
  normalizePaymentType,
  orderStatusChromeClass,
  pickAddedPaymentMethod,
  redistributeCashPaymentLine,
  sortOrders,
} from './pdv-helpers'
import { ProductPreview, ProductThumbImage } from './PdvProductPreview'
import { readTopProductsCache, writeTopProductsCache } from './pdv-top-products-cache'
import {
  findLocalCatalogByCode,
  readSessionCatalogSnapshot,
  searchLocalCatalog,
  writeSessionCatalogSnapshot,
} from './pdv-catalog-cache'
import {
  DiscountField,
  inputGroupShell,
  insertFormFieldClass,
  pdvColumnHeaderClass,
  pdvColumnTitleClass,
  QuantityStepper,
} from './PdvFormControls'

const SalesOrderAfterSaleDialog = dynamic(
  () => import('@/app/(portal)/portal/vendas/SalesOrderAfterSaleActions').then((m) => ({
    default: m.SalesOrderAfterSaleDialog,
  })),
  { ssr: false },
)

async function openCashClosePrintLazy (
  ...args: Parameters<typeof import('@/lib/pdv/open-cash-close-print').openCashClosePrint>
) {
  const { openCashClosePrint } = await import('@/lib/pdv/open-cash-close-print')
  return openCashClosePrint(...args)
}

async function openSalesOrderCupomPrintLazy (orderId: string) {
  const { openSalesOrderCupomPrint } = await import('@/app/(portal)/portal/vendas/SalesOrderCupomPrint')
  return openSalesOrderCupomPrint(orderId)
}

async function openNfceDanfePrintLazy (documentId: string) {
  const { openNfceDanfePrint } = await import('@/app/(portal)/portal/vendas/SalesOrderCupomPrint')
  return openNfceDanfePrint(documentId)
}

type PdvNfceDocument = {
  id: string
  status: 'pending' | 'authorized' | 'rejected' | 'canceled' | 'denied' | string
  sefaz_status_code?: string | null
  sefaz_status_message?: string | null
}

function pdvNfceMenuLabel (order: OrderSummary) {
  if (order.nfce_status === 'authorized') return 'Imprimir NFC-e'
  if (order.nfce_status === 'rejected' || order.nfce_status === 'denied') return 'Abrir NFC-e'
  return 'Gerar NFC-e'
}

function patchSessionOrderNfce (
  orders: OrderSummary[],
  orderId: string,
  nfce: { status?: string | null, id?: string | null },
) {
  return orders.map((row) => (
    row.id === orderId
      ? {
        ...row,
        nfce_status: (nfce.status || row.nfce_status) as OrderSummary['nfce_status'],
        nfce_document_id: nfce.id || row.nfce_document_id,
      }
      : row
  ))
}

export function PdvClient ({ sellerName, organizationId = null }: PdvClientProps) {
  const router = useRouter()
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
  const [catalogCache, setCatalogCache] = useState<CatalogProduct[]>([])
  const [syncingCatalog, setSyncingCatalog] = useState(false)
  const catalogPrefetchRef = useRef<AbortController | null>(null)
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
  const [customerDocument, setCustomerDocument] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerMatches, setCustomerMatches] = useState<PdvCustomerMatch[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingCustomerDoc, setLoadingCustomerDoc] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement>(null)
  const customerNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipCustomerNameSearchRef = useRef(false)
  const skipCustomerDocLookupRef = useRef(false)

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<PaymentLine[]>([])
  const [discountTotalMasked, setDiscountTotalMasked] = useState('')
  const [orderDiscountMode, setOrderDiscountMode] = useState<'fixed' | 'percent'>('fixed')
  const [surchargeMasked, setSurchargeMasked] = useState('')
  const [cashReceivedMasked, setCashReceivedMasked] = useState('')
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)
  const [nfceBusyId, setNfceBusyId] = useState<string | null>(null)

  const [sangriaOpen, setSangriaOpen] = useState(false)
  const [suprimentoOpen, setSuprimentoOpen] = useState(false)
  const [closeCashOpen, setCloseCashOpen] = useState(false)
  const [afterSaleOpen, setAfterSaleOpen] = useState(false)
  const [afterSaleOrderId, setAfterSaleOrderId] = useState<string | null>(null)
  const [afterSaleOrderNumber, setAfterSaleOrderNumber] = useState<number | string | null>(null)
  const [afterSaleSaving, setAfterSaleSaving] = useState(false)
  const [afterSaleError, setAfterSaleError] = useState<string | null>(null)
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [closeSummary, setCloseSummary] = useState<CashCloseSummary | null>(null)
  const [loadingCloseSummary, setLoadingCloseSummary] = useState(false)
  const [closeCountedCash, setCloseCountedCash] = useState('')
  const [closeCountedByMethod, setCloseCountedByMethod] = useState<Partial<Record<PaymentMethodType, string>>>({})

  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  const subtotalCents = useMemo(() => cart.reduce((acc, item) => {
    const raw = item.quantity * item.unitPriceCents
    return acc + Math.max(0, raw - item.discountCents)
  }, 0), [cart])

  const discountTotalCents = useMemo(() => {
    if (orderDiscountMode === 'percent') {
      const pct = Math.min(100, Math.max(0, Number(discountTotalMasked.replace(',', '.')) || 0))
      return Math.round(subtotalCents * pct / 100)
    }
    return Math.min(subtotalCents, moneyToCentsFromMasked(discountTotalMasked) || 0)
  }, [orderDiscountMode, discountTotalMasked, subtotalCents])

  const surchargeCents = moneyToCentsFromMasked(surchargeMasked) || 0
  // Desconto só nos itens; cobrança adicional soma no total sem desconto.
  const totalCents = Math.max(0, subtotalCents - discountTotalCents) + surchargeCents
  const customerType = customerTypeFromDocument(customerDocument)
  const hasCartItems = cart.length > 0
  const paidCents = useMemo(() => payments.reduce((acc, p) => acc + (moneyToCentsFromMasked(p.amountMasked) || 0), 0), [payments])
  const remainingCents = Math.max(0, totalCents - paidCents)
  const overpaidCents = Math.max(0, paidCents - totalCents)
  const hasCashPayment = payments.some((p) => p.payment_method_type === 'dinheiro')
  const cashPaidCents = useMemo(() => payments
    .filter((p) => p.payment_method_type === 'dinheiro')
    .reduce((acc, p) => acc + (moneyToCentsFromMasked(p.amountMasked) || 0), 0), [payments])
  const changeCents = useMemo(() => {
    if (!hasCashPayment) return 0
    const received = moneyToCentsFromMasked(cashReceivedMasked)
    if (received == null || received <= 0) return 0
    // Troco = recebido − o que ainda precisa ser pago em dinheiro (linha dinheiro).
    return Math.max(0, received - cashPaidCents)
  }, [hasCashPayment, cashPaidCents, cashReceivedMasked])

  useEffect(() => {
    if (!hasCashPayment && cashReceivedMasked) {
      setCashReceivedMasked('')
    }
  }, [hasCashPayment, cashReceivedMasked])
  const cashDueCents = useMemo(() => {
    // Quanto ainda falta considerar no dinheiro (parcela dinheiro + faltante geral).
    if (!hasCashPayment) return remainingCents
    return Math.max(cashPaidCents, remainingCents + cashPaidCents)
  }, [hasCashPayment, cashPaidCents, remainingCents])

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
    setShowOpenCashModal(false)
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

  const loadTopProducts = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force) {
      const cached = readTopProductsCache(organizationId)
      if (cached?.length) {
        setTopProducts(cached)
        setLoadingTopProducts(false)
        return
      }
    }

    setLoadingTopProducts(true)
    const res = await portalFetch('/api/portal/pdv/top-products?limit=5')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.products)) {
      const products = data.products.map((row: Record<string, unknown>) => mapCatalogProduct(row))
      setTopProducts(products)
      writeTopProductsCache(organizationId, products)
    } else if (!options?.force) {
      setTopProducts([])
    }
    setLoadingTopProducts(false)
  }, [organizationId])

  useEffect(() => {
    const cached = readTopProductsCache(organizationId)
    if (cached?.length) {
      setTopProducts(cached)
      setLoadingTopProducts(false)
      return
    }

    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const run = () => { void loadTopProducts({ force: true }) }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timeoutId = setTimeout(run, 600)
    }
    return () => {
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [loadTopProducts, organizationId])

  const loadMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  const prefetchCatalogSnapshot = useCallback(async (options?: {
    force?: boolean
    notify?: boolean
  }) => {
    if (!organizationId) return { ok: false as const, count: 0 }

    const force = Boolean(options?.force)
    const notify = Boolean(options?.notify)

    if (!force) {
      const sessionProducts = readSessionCatalogSnapshot(organizationId)
      if (sessionProducts?.length) {
        setCatalogCache(sessionProducts)
      }
    }

    catalogPrefetchRef.current?.abort()
    const controller = new AbortController()
    catalogPrefetchRef.current = controller

    if (notify || force) setSyncingCatalog(true)

    try {
      const res = await portalFetch('/api/portal/pdv/catalog?snapshot=1', {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return { ok: false as const, count: 0 }
      const data = await res?.json().catch(() => null)
      if (controller.signal.aborted) return { ok: false as const, count: 0 }
      if (!data?.ok || !Array.isArray(data.products)) {
        if (notify) {
          toast({
            title: 'Não foi possível sincronizar produtos',
            variant: 'destructive',
          })
        }
        return { ok: false as const, count: 0 }
      }

      const products = data.products.map((row: Record<string, unknown>) => mapCatalogProduct(row))
      setCatalogCache(products)
      writeSessionCatalogSnapshot(organizationId, products)

      if (notify) {
        toast({
          title: 'Produtos sincronizados',
          description: products.length === 1
            ? '1 produto disponível no PDV.'
            : `${products.length} produtos disponíveis no PDV.`,
        })
      }

      return { ok: true as const, count: products.length }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false as const, count: 0 }
      }
      if (notify) {
        toast({
          title: 'Não foi possível sincronizar produtos',
          variant: 'destructive',
        })
      }
      return { ok: false as const, count: 0 }
    } finally {
      if (!controller.signal.aborted && (notify || force)) {
        setSyncingCatalog(false)
      }
    }
  }, [organizationId])

  const syncCatalogNow = useCallback(() => {
    if (syncingCatalog) return
    void prefetchCatalogSnapshot({ force: true, notify: true })
  }, [prefetchCatalogSnapshot, syncingCatalog])

  const prefetchPdvSessionData = useCallback(() => {
    void loadMethods()
    void prefetchCatalogSnapshot()
  }, [loadMethods, prefetchCatalogSnapshot])

  const searchProducts = useCallback(async (value: string) => {
    const q = value.trim()
    if (!q) {
      setSearchResults([])
      setShowSearchDropdown(false)
      setLoadingProducts(false)
      return
    }

    // Busca local imediata quando o snapshot já está em memória.
    if (catalogCache.length > 0) {
      const local = searchLocalCatalog(catalogCache, q, 10)
      setSearchResults(local)
      setShowSearchDropdown(true)
      setLoadingProducts(false)
      return
    }

    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setLoadingProducts(true)
    try {
      const res = await portalFetch(`/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const data = await res?.json().catch(() => null)
      if (controller.signal.aborted) return
      if (data?.ok && Array.isArray(data.products)) {
        setSearchResults(data.products.slice(0, 10).map((row: Record<string, unknown>) => mapCatalogProduct(row)))
        setShowSearchDropdown(true)
      } else {
        setSearchResults([])
        setShowSearchDropdown(false)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (controller.signal.aborted) return
      setSearchResults([])
      setShowSearchDropdown(false)
    } finally {
      if (!controller.signal.aborted) setLoadingProducts(false)
    }
  }, [catalogCache])

  const lookupProductByBarcode = useCallback(async (code: string) => {
    const barcode = code.trim()
    if (!barcode) return null

    const local = findLocalCatalogByCode(catalogCache, barcode)
    if (local) return local

    const res = await portalFetch(`/api/portal/pdv/catalog?barcode=${encodeURIComponent(barcode)}`)
    const data = await res?.json().catch(() => null)
    if (!data?.ok || !Array.isArray(data.products) || data.products.length === 0) return null
    const exact = data.products.find((row: Record<string, unknown>) => {
      const rowBarcode = row.barcode != null ? String(row.barcode).trim() : ''
      const rowSku = row.sku != null ? String(row.sku).trim() : ''
      return rowBarcode === barcode || rowSku === barcode
    })
    return mapCatalogProduct((exact || data.products[0]) as Record<string, unknown>)
  }, [catalogCache])

  useEffect(() => {
    void loadCash()
    void loadMethods()
  }, [loadCash, loadMethods])

  useEffect(() => {
    if (!cashOpen) return
    prefetchPdvSessionData()
  }, [cashOpen, prefetchPdvSessionData])

  useEffect(() => {
    if (cashOpen) void loadSessionOrders()
  }, [cashOpen, loadSessionOrders])

  useEffect(() => {
    setPayments((prev) => {
      if (paymentMethods.length === 0) return prev

      if (!hasCartItems || totalCents <= 0) {
        const defaults = buildDefaultPaymentLine(0, paymentMethods)
        if (prev.length === 1
          && prev[0].payment_method_id === defaults.payment_method_id
          && prev[0].amountMasked === defaults.amountMasked) {
          return prev
        }
        return [defaults]
      }

      if (prev.length === 0) {
        return [buildDefaultPaymentLine(totalCents, paymentMethods)]
      }

      if (prev.length === 1) {
        const nextAmount = maskedFromCents(totalCents)
        if (prev[0].amountMasked === nextAmount) return prev
        return [{ ...prev[0], amountMasked: nextAmount }]
      }

      const receivedCents = moneyToCentsFromMasked(cashReceivedMasked) || 0
      if (receivedCents > 0 && prev.some((line) => line.payment_method_type === 'dinheiro')) {
        return redistributeCashPaymentLine(prev, totalCents)
      }

      return prev
    })

    if (!hasCartItems || totalCents <= 0) {
      setCashReceivedMasked('')
    }
  }, [totalCents, paymentMethods, hasCartItems, cashReceivedMasked])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const q = query.trim()
      if (!q) {
        setSearchResults([])
        setShowSearchDropdown(false)
        return
      }
      // Leitores enviam dígitos + Enter; evita dropdown piscando no meio do scan.
      if (isLikelyBarcode(q)) {
        setShowSearchDropdown(false)
        return
      }
      void searchProducts(q)
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
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (skipCustomerNameSearchRef.current) {
      skipCustomerNameSearchRef.current = false
      return
    }
    if (customerNameDebounceRef.current) clearTimeout(customerNameDebounceRef.current)
    customerNameDebounceRef.current = setTimeout(() => {
      void searchCustomersByName(customerName)
    }, 300)
    return () => {
      if (customerNameDebounceRef.current) clearTimeout(customerNameDebounceRef.current)
    }
  }, [customerName])

  useEffect(() => {
    if (skipCustomerDocLookupRef.current) {
      skipCustomerDocLookupRef.current = false
      return
    }
    const digits = customerDocument.replace(/\D/g, '')
    const isComplete = digits.length === 11 || digits.length === 14
    if (!isComplete) {
      setLoadingCustomerDoc(false)
      return
    }
    let cancelled = false
    setLoadingCustomerDoc(true)
    void (async () => {
      const existing = await lookupCustomerByDocument(digits)
      if (cancelled) return
      setLoadingCustomerDoc(false)
      if (!existing) return
      applyCustomerFromCadastro(existing)
      toast({
        title: 'Cliente encontrado',
        description: customerDisplayName(existing),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [customerDocument])

  const buildOrderPayload = useCallback((cartItems?: CartItem[]) => {
    const source = cartItems ?? cart
    return {
      customer_name: customerName,
      customer_type: customerType,
      customer_document: customerDocument.replace(/\D/g, '') || null,
      discount_total_cents: discountTotalCents,
      surcharge_cents: surchargeCents,
      items: source.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        unit_cost_cents: item.unitCostCents,
        discount_cents: item.discountCents,
      })),
    }
  }, [cart, customerName, customerType, customerDocument, discountTotalCents, surchargeCents])

  const persistOrderDraft = useCallback(async (
    payload: ReturnType<typeof buildOrderPayload>,
    orderId: string | null,
    options?: {
      silent?: boolean
      /** Se true, atualiza o pedido ativo da tela (evitar em saves em background). */
      applyToActiveDraft?: boolean
      /** Atualiza a lista lateral de pedidos da sessão. */
      refreshSessionOrders?: boolean
    },
  ): Promise<{ ok: boolean, orderId?: string | null, orderNumber?: number | null }> => {
    if (!cashOpen || payload.items.length === 0) return { ok: false }

    const silent = Boolean(options?.silent)
    const applyToActiveDraft = Boolean(options?.applyToActiveDraft)
    const refreshSessionOrders = options?.refreshSessionOrders !== false

    if (!orderId) {
      const res = await portalFetch('/api/portal/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.order_id) {
        const orderNumber = data.order?.order_number ?? null
        if (applyToActiveDraft) {
          setCurrentOrderId(data.order_id)
          setCurrentOrderNumber(orderNumber)
        }
        if (refreshSessionOrders) void loadSessionOrders()
        return { ok: true, orderId: data.order_id, orderNumber }
      }
      if (!silent) {
        toast({ title: data?.error || 'Erro ao salvar pedido', variant: 'destructive' })
      }
      return { ok: false }
    }

    const res = await portalFetch(`/api/portal/sales-orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res?.json().catch(() => null)
    if (data?.ok) {
      const orderNumber = data.order?.order_number ?? null
      if (refreshSessionOrders) void loadSessionOrders()
      return { ok: true, orderId, orderNumber }
    }
    if (!silent) {
      toast({ title: data?.error || 'Erro ao atualizar pedido', variant: 'destructive' })
    }
    return { ok: false }
  }, [cashOpen, loadSessionOrders])

  function saveDraftInBackground (
    payload: ReturnType<typeof buildOrderPayload>,
    orderId: string | null,
    options?: { successToast?: boolean },
  ) {
    void persistOrderDraft(payload, orderId, {
      silent: true,
      applyToActiveDraft: false,
      refreshSessionOrders: true,
    }).then((result) => {
      if (result.ok) {
        if (options?.successToast !== false) {
          const orderLabel = result.orderNumber != null ? `#${result.orderNumber}` : ''
          toast({
            title: orderLabel ? `Pedido ${orderLabel} salvo` : 'Pedido salvo',
            description: 'Venda anterior ficou em andamento. Você pode retomá-la na lista.',
          })
        }
        return
      }
      toast({
        title: 'Não foi possível salvar a venda anterior',
        description: 'Verifique a lista de pedidos ou tente novamente.',
        variant: 'destructive',
      })
    })
  }

  async function handleSearchSubmit () {
    const code = query.trim()
    if (!code) return

    setLoadingProducts(true)
    try {
      if (isLikelyBarcode(code)) {
        const product = await lookupProductByBarcode(code)
        if (product) {
          const added = addProductToCart(product, 1)
          if (added) {
            requestAnimationFrame(() => {
              document.getElementById('pdv-search')?.focus()
            })
          }
          return
        }
        toast({ title: 'Código não encontrado', description: code, variant: 'destructive' })
        setShowSearchDropdown(false)
        return
      }

      let products: CatalogProduct[] = []
      if (catalogCache.length > 0) {
        products = searchLocalCatalog(catalogCache, code, 10)
      } else {
        const res = await portalFetch(`/api/portal/pdv/catalog?q=${encodeURIComponent(code)}`)
        const data = await res?.json().catch(() => null)
        products = Array.isArray(data?.products)
          ? data.products.map((row: Record<string, unknown>) => mapCatalogProduct(row))
          : []
      }

      const exact = products.find((p: CatalogProduct) => (
        (p.barcode && p.barcode.trim() === code)
        || (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase())
      ))

      if (exact) {
        selectProduct(exact)
        setSearchResults([])
        return
      }

      if (products.length === 1) {
        selectProduct(products[0])
        setSearchResults([])
        return
      }

      setSearchResults(products.slice(0, 10))
      setShowSearchDropdown(true)
      if (products.length === 0) {
        toast({ title: 'Nenhum produto encontrado', variant: 'destructive' })
      }
    } finally {
      setLoadingProducts(false)
    }
  }

  function fillRemainingOnPaymentLine (idx = 0) {
    if (totalCents <= 0) return
    setPayments((prev) => {
      if (prev.length === 0) {
        if (paymentMethods.length === 0) return prev
        return [buildDefaultPaymentLine(totalCents, paymentMethods)]
      }
      return clampPaymentLineAmount(prev, idx, totalCents, totalCents)
    })
  }

  function setCashReceivedQuick (cents: number) {
    setCashReceivedMasked(maskedFromCents(Math.max(0, cents)))
  }

  function resetDraft () {
    setCart([])
    setPayments([])
    setDiscountTotalMasked('')
    setOrderDiscountMode('fixed')
    setSurchargeMasked('')
    setCashReceivedMasked('')
    setCurrentOrderId(null)
    setCurrentOrderNumber(null)
    setCustomerName('Consumidor Final')
    setCustomerDocument('')
    setCustomerId(null)
    setCustomerMatches([])
    setShowCustomerDropdown(false)
    setLoadingCustomerDoc(false)
    setSelectedProduct(null)
    setInsertQty(1)
    setInsertUnitPriceMasked('')
    setItemDiscountMasked('')
    setEditingCartLineId(null)
    setActiveTab('produto')
  }

  function startNewSale () {
    if (!cashOpen) return

    if (cart.length === 0) {
      resetDraft()
      return
    }

    const payload = buildOrderPayload()
    const previousOrderId = currentOrderId
    resetDraft()
    saveDraftInBackground(payload, previousOrderId)
  }

  type CustomerMatch = PdvCustomerMatch

  function customerDisplayName (row: {
    is_company?: boolean | null
    full_name?: string | null
    company_name?: string | null
    trade_name?: string | null
  }) {
    if (row.is_company) {
      return String(row.company_name || row.trade_name || row.full_name || 'Empresa').trim()
    }
    return String(row.full_name || row.company_name || 'Cliente').trim()
  }

  function applyCustomerFromCadastro (row: CustomerMatch['raw']) {
    const isCompany = Boolean(row.is_company)
    const name = customerDisplayName(row)
    const digits = String(isCompany ? row.cnpj || '' : row.cpf || '').replace(/\D/g, '')
    skipCustomerNameSearchRef.current = true
    skipCustomerDocLookupRef.current = true
    setCustomerId(String(row.id))
    setCustomerName(name || (isCompany ? 'Empresa' : 'Cliente'))
    setCustomerDocument(formatCpfCnpj(digits))
    setCustomerMatches([])
    setShowCustomerDropdown(false)
    setLoadingCustomerDoc(false)
  }

  async function lookupCustomerByDocument (digits: string) {
    if (digits.length < 5) return null
    const res = await portalFetch(
      `/api/portal/customers/search?documentPrefix=${encodeURIComponent(digits)}`
    )
    const data = await res?.json().catch(() => null)
    if (!data?.ok || !Array.isArray(data.customers)) return null
    const exact = data.customers.find((row: { cpf?: string | null, cnpj?: string | null }) => {
      const cpf = String(row.cpf || '').replace(/\D/g, '')
      const cnpj = String(row.cnpj || '').replace(/\D/g, '')
      return cpf === digits || cnpj === digits
    })
    return (exact as CustomerMatch['raw'] | undefined) || null
  }

  async function searchCustomersByName (name: string) {
    const q = name.trim()
    if (q.length < 2 || q.toLowerCase() === 'consumidor final') {
      setCustomerMatches([])
      setShowCustomerDropdown(false)
      return
    }
    setLoadingCustomers(true)
    const res = await portalFetch(`/api/portal/customers/search?q=${encodeURIComponent(q)}`)
    const data = await res?.json().catch(() => null)
    setLoadingCustomers(false)
    if (!data?.ok || !Array.isArray(data.customers)) {
      setCustomerMatches([])
      setShowCustomerDropdown(false)
      return
    }
    const matches: CustomerMatch[] = data.customers.slice(0, 10).map((row: CustomerMatch['raw']) => {
      const isCompany = Boolean(row.is_company)
      const digits = String(isCompany ? row.cnpj || '' : row.cpf || '').replace(/\D/g, '')
      return {
        id: String(row.id),
        label: customerDisplayName(row),
        document: formatCpfCnpj(digits),
        isCompany,
        raw: row,
      }
    })
    setCustomerMatches(matches)
    setShowCustomerDropdown(matches.length > 0)
  }

  async function ensureCustomerInCadastro () {
    const digits = customerDocument.replace(/\D/g, '')
    const name = customerName.trim()
    const isDefaultConsumer = !digits && (
      !name || name.toLowerCase() === 'consumidor final'
    )
    if (isDefaultConsumer) return { ok: true as const, skipped: true as const }
    if (!digits) return { ok: true as const, skipped: true as const }

    const expectedLen = customerType === 'pj' ? 14 : 11
    if (digits.length !== expectedLen) return { ok: true as const, skipped: true as const }

    if (customerId) return { ok: true as const, customerId }

    const existing = await lookupCustomerByDocument(digits)
    if (existing?.id) {
      applyCustomerFromCadastro(existing)
      return { ok: true as const, customerId: String(existing.id) }
    }

    const res = await portalFetch('/api/portal/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isCompany: customerType === 'pj',
        document: digits,
        fullName: customerType === 'pf' ? name : '',
        companyName: customerType === 'pj' ? name : '',
      }),
    })
    const data = await res?.json().catch(() => null)
    if (data?.ok && data.id) {
      setCustomerId(String(data.id))
      return { ok: true as const, customerId: String(data.id), created: true as const }
    }
    if (data?.error === 'already_exists' && data.existingCustomerId) {
      setCustomerId(String(data.existingCustomerId))
      return { ok: true as const, customerId: String(data.existingCustomerId) }
    }
    return {
      ok: false as const,
      error: data?.message || data?.error || 'customer_create_failed',
    }
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
    void refreshSelectedProductDetails(product.id)
  }

  async function refreshSelectedProductDetails (productId: string) {
    const res = await portalFetch(
      `/api/portal/pdv/catalog?id=${encodeURIComponent(productId)}`,
    )
    const data = await res?.json().catch(() => null)
    const raw = Array.isArray(data?.products) ? data.products[0] : null
    if (!raw || !data?.ok) return
    const catalog = mapCatalogProduct(raw as Record<string, unknown>)
    setSelectedProduct((prev) => {
      if (!prev || prev.id !== productId) return prev
      return {
        ...catalog,
        // Mantém preço já editado no formulário, se houver.
        sale_price_cents: prev.sale_price_cents ?? catalog.sale_price_cents,
      }
    })
  }

  async function beginEditCartItem (lineId: string) {
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
      kind: 'product',
    })
    setInsertQty(item.quantity)
    setInsertUnitPriceMasked(maskedFromCents(item.unitPriceCents))
    setItemDiscountMode('fixed')
    setItemDiscountMasked(maskedFromCents(item.discountCents))
    setQuery('')
    setShowSearchDropdown(false)
    setActiveTab('produto')

    const res = await portalFetch(
      `/api/portal/pdv/catalog?id=${encodeURIComponent(item.productId)}`,
    )
    const data = await res?.json().catch(() => null)
    const raw = Array.isArray(data?.products) ? data.products[0] : null
    if (!raw || !data?.ok) return

    const catalog = mapCatalogProduct(raw as Record<string, unknown>)
    setSelectedProduct({
      ...catalog,
      // Mantém preço e custo da linha em edição no formulário.
      sale_price_cents: item.unitPriceCents,
      cost_price_cents: item.unitCostCents,
    })
  }

  function addProductToCart (product: CatalogProduct, quantity = 1) {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa antes de vender', variant: 'destructive' })
      return false
    }

    const unitPriceCents = Number(product.sale_price_cents) || 0
    const newItem: CartItem = {
      lineId: createCartLineId(),
      productId: product.id,
      name: product.name,
      quantity: Math.max(1, quantity),
      unitPriceCents,
      unitCostCents: Number(product.cost_price_cents) || 0,
      discountCents: 0,
    }

    setCart((prev) => mergeCartItem(prev, newItem))
    setEditingCartLineId(null)
    setSelectedProduct(null)
    setInsertUnitPriceMasked('')
    setItemDiscountMasked('')
    setInsertQty(1)
    setQuery('')
    setSearchResults([])
    setShowSearchDropdown(false)
    return true
  }

  function insertItem () {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa antes de vender', variant: 'destructive' })
      return
    }
    if (!selectedProduct) {
      toast({ title: 'Selecione um produto', variant: 'destructive' })
      return
    }

    if (editingCartLineId) {
      setCart((prev) => prev.map((item) => (
        item.lineId === editingCartLineId
          ? {
              ...item,
              quantity: insertQty,
              unitPriceCents: insertUnitCents,
              discountCents: insertDiscountCents,
            }
          : item
      )))
      cancelCartLineEdit()
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

    setCart((prev) => mergeCartItem(prev, newItem))
    setItemDiscountMasked('')
    setInsertQty(1)
  }

  function updateCartItem (lineId: string, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((item) => item.lineId === lineId ? { ...item, ...patch } : item))
  }

  function removeCartItem (lineId: string) {
    setCart((prev) => prev.filter((item) => item.lineId !== lineId))
  }

  async function loadOrderIntoCart (orderId: string) {
    if (orderId === currentOrderId) return
    if (loadingOrderId) return

    // Parqueia a venda atual em background e carrega a escolhida na hora.
    if (cashOpen && cart.length > 0) {
      const payload = buildOrderPayload()
      const previousOrderId = currentOrderId
      saveDraftInBackground(payload, previousOrderId, { successToast: false })
    }

    setLoadingOrderId(orderId)

    const res = await portalFetch(`/api/portal/sales-orders/${orderId}`)
    const data = await res?.json().catch(() => null)
    if (!data?.ok) {
      setLoadingOrderId(null)
      toast({ title: 'Erro ao carregar pedido', variant: 'destructive' })
      return
    }
    if (data.order.status !== 'in_progress') {
      setLoadingOrderId(null)
      return
    }

    skipCustomerNameSearchRef.current = true
    skipCustomerDocLookupRef.current = true
    setCurrentOrderId(data.order.id)
    setCurrentOrderNumber(data.order.order_number)
    setCustomerName(data.order.customer_name || 'Consumidor Final')
    setCustomerDocument(formatCpfCnpj(String(data.order.customer_document || '')))
    setCustomerId(null)
    setCustomerMatches([])
    setShowCustomerDropdown(false)
    setOrderDiscountMode('fixed')
    setDiscountTotalMasked(maskedFromCents(data.order.discount_total_cents || 0))
    setSurchargeMasked(
      Number(data.order.surcharge_cents) > 0
        ? maskedFromCents(data.order.surcharge_cents)
        : '',
    )

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
      metadata?: { installments?: number } | null
    }) => ({
      payment_method_id: p.payment_method_id ?? null,
      payment_method_type: p.payment_method_type,
      amountMasked: maskedFromCents(p.amount_cents),
      installments: Math.max(1, Number(p.metadata?.installments) || 1),
    }))
    setPayments(payLines)
    setCashReceivedMasked('')
    setLoadingOrderId(null)
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
      const closedSessionId = String(data.session?.id || closeSummary.session_id || '')
      void openCashClosePrintLazy({
        sessionId: closedSessionId || null,
        sellerName,
        countedCashCents,
        countedByMethod,
      })
      setCashOpen(false)
      setCloseCashOpen(false)
      setShowOpenCashModal(false)
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

  function printCloseReport () {
    if (!closeSummary) {
      toast({ title: 'Aguarde o resumo do caixa', variant: 'destructive' })
      return
    }
    const countedCashCents = closeCountedCash.trim()
      ? (moneyToCentsFromMasked(closeCountedCash) ?? 0)
      : null
    const countedByMethod: Partial<Record<PaymentMethodType, number>> = {}
    for (const type of closeSummary.methods_used) {
      if (type === 'dinheiro') continue
      const raw = closeCountedByMethod[type]
      if (!raw?.trim()) continue
      countedByMethod[type] = moneyToCentsFromMasked(raw) ?? 0
    }
    void openCashClosePrintLazy({
      sessionId: closeSummary.session_id,
      sellerName,
      countedCashCents,
      countedByMethod: Object.keys(countedByMethod).length > 0 ? countedByMethod : null,
    })
  }

  function addPaymentLine (method?: PaymentMethod) {
    const picked = method ?? pickAddedPaymentMethod(paymentMethods)
    setPayments((prev) => {
      const next = [...prev, {
        payment_method_id: picked?.id ?? null,
        payment_method_type: picked ? normalizePaymentType(picked.type) : 'outro',
        amountMasked: '',
        installments: 1,
      }]
      const receivedCents = moneyToCentsFromMasked(cashReceivedMasked) || 0
      if (receivedCents > 0 && next.some((line) => line.payment_method_type === 'dinheiro')) {
        return redistributeCashPaymentLine(next, totalCents)
      }
      return next
    })
  }

  function setPaymentLine (idx: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((line, index) => (index === idx ? { ...line, ...patch } : line)))
  }

  /** Redistribui dinheiro ao sair do campo de valor (não altera o valor digitado). */
  function commitPaymentLineAmount (idx: number) {
    setPayments((prev) => {
      const line = prev[idx]
      if (!line) return prev
      if (line.payment_method_type === 'dinheiro') return prev

      const receivedCents = moneyToCentsFromMasked(cashReceivedMasked) || 0
      if (
        receivedCents > 0
        && prev.some((row) => row.payment_method_type === 'dinheiro')
      ) {
        return redistributeCashPaymentLine(prev, totalCents)
      }

      return prev
    })
  }

  function removePaymentLine (idx: number) {
    setPayments((prev) => {
      let next = prev.filter((_, index) => index !== idx)
      if (next.length === 0 && totalCents > 0 && paymentMethods.length > 0) {
        next = [buildDefaultPaymentLine(totalCents, paymentMethods)]
      } else {
        const receivedCents = moneyToCentsFromMasked(cashReceivedMasked) || 0
        if (receivedCents > 0 && next.some((line) => line.payment_method_type === 'dinheiro')) {
          next = redistributeCashPaymentLine(next, totalCents)
        }
      }
      return next
    })
  }

  async function cancelCurrentOrder () {
    if (!currentOrderId) {
      resetDraft()
      return
    }
    const status = sessionOrders.find((o) => o.id === currentOrderId)?.status ?? 'in_progress'
    await cancelOrderById(currentOrderId, status)
  }

  async function cancelOrderById (orderId: string, statusHint?: OrderSummary['status'] | null) {
    const status = statusHint
      || sessionOrders.find((o) => o.id === orderId)?.status
      || (orderId === currentOrderId ? 'in_progress' : null)

    const isPaid = status === 'paid'
    let reason = 'Cancelado no PDV'
    if (isPaid) {
      const typed = await appPrompt({
        title: 'Estornar venda paga',
        description: 'Estoque e financeiro serão revertidos.',
        label: 'Motivo do estorno',
        required: true,
        destructive: true,
        confirmLabel: 'Estornar',
      })
      if (typed == null) return
      reason = typed
    } else if (!(await appConfirm({
      title: 'Cancelar este pedido?',
      confirmLabel: 'Cancelar',
      destructive: true,
    }))) {
      return
    }

    setBusy(true)
    const res = await portalFetch(`/api/portal/sales-orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      if (currentOrderId === orderId) resetDraft()
      void loadSessionOrders()
      toast({
        title: isPaid ? 'Venda estornada' : 'Pedido cancelado',
        description: data.bling_warning || undefined,
      })
      return
    }
    toast({
      title: data?.message || data?.error || 'Erro ao cancelar',
      variant: 'destructive',
    })
  }

  async function emitNfceForOrder (order: OrderSummary) {
    if (order.status !== 'paid') {
      toast({
        title: 'Venda ainda não está paga',
        description: 'A NFC-e só pode ser emitida para vendas pagas.',
        variant: 'destructive',
      })
      return
    }

    setNfceBusyId(order.id)
    try {
      const stateRes = await portalFetch(`/api/portal/sales-orders/${encodeURIComponent(order.id)}/emit-nfce`)
      const stateData = await stateRes?.json().catch(() => null)
      const fiscalDocument = (stateData?.fiscal_document ?? null) as PdvNfceDocument | null

      if (fiscalDocument?.id && (
        fiscalDocument.status === 'rejected' ||
        fiscalDocument.status === 'denied' ||
        (fiscalDocument.status === 'pending' && isProductFiscalCorrectionError(fiscalDocument.sefaz_status_code))
      )) {
        setSessionOrders((prev) => patchSessionOrderNfce(prev, order.id, fiscalDocument))
        router.push(nfceEditorHref(fiscalDocument.id, {
          corrigir: isProductFiscalCorrectionError(fiscalDocument.sefaz_status_code),
        }))
        return
      }

      if (stateData?.danfe_url && fiscalDocument?.id) {
        setSessionOrders((prev) => patchSessionOrderNfce(prev, order.id, {
          status: fiscalDocument.status || 'authorized',
          id: fiscalDocument.id,
        }))
        toast({
          variant: 'success',
          title: 'NFC-e já autorizada',
          description: 'Abrindo a NFC-e para impressão.',
        })
        await openNfceDanfePrintLazy(fiscalDocument.id)
        return
      }

      const endpoint = fiscalDocument?.id && fiscalDocument.status !== 'authorized'
        ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/retry`
        : `/api/portal/sales-orders/${encodeURIComponent(order.id)}/emit-nfce`

      const res = await portalFetch(endpoint, { method: 'POST' })
      const data = await res?.json().catch(() => null)
      const nextDocument = (data?.fiscal_document ?? null) as PdvNfceDocument | null
      if (!data?.ok) {
        if (data?.needs_correction && nextDocument?.id) {
          setSessionOrders((prev) => patchSessionOrderNfce(prev, order.id, nextDocument))
          toast({
            title: 'Complete NCM e CEST',
            description: data.message || 'Preencha os dados fiscais dos produtos para emitir a NFC-e.',
          })
          router.push(nfceEditorHref(nextDocument.id, { corrigir: true }))
          return
        }
        toast({
          title: 'NFC-e não autorizada',
          description: data?.message || data?.error || 'Não foi possível emitir a NFC-e.',
          variant: 'destructive',
        })
        return
      }

      if (nextDocument?.id) {
        setSessionOrders((prev) => patchSessionOrderNfce(prev, order.id, nextDocument))
      }

      if (data.danfe_url && nextDocument?.id) {
        toast({
          variant: 'success',
          title: data.already_authorized ? 'NFC-e já autorizada' : 'NFC-e autorizada',
          description: 'Abrindo a NFC-e para impressão.',
        })
        await openNfceDanfePrintLazy(nextDocument.id)
        return
      }

      toast({
        title: 'NFC-e não autorizada',
        description: nextDocument?.sefaz_status_message || 'A SEFAZ retornou a nota sem autorização.',
        variant: 'destructive',
      })
      if (nextDocument?.id) {
        router.push(nfceEditorHref(nextDocument.id))
      }
    } finally {
      setNfceBusyId(null)
    }
  }

  function finalizeOrder () {
    if (afterSaleOpen || afterSaleSaving) return
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
    if (paidCents > totalCents) {
      toast({
        title: 'Pagamento acima do total',
        description: 'A soma das formas de pagamento não pode passar do total da venda. Use “Recebido em dinheiro” para o troco.',
        variant: 'destructive',
      })
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

    const orderPayload = buildOrderPayload()
    const paymentPayload = payments.map((line) => ({
      payment_method_id: line.payment_method_id ?? null,
      payment_method_type: line.payment_method_type,
      amount_cents: moneyToCentsFromMasked(line.amountMasked) || 0,
      installments: line.payment_method_type === 'credito' ? Math.max(1, line.installments || 1) : 1,
      status: 'paid' as const,
    })).filter((line) => line.amount_cents > 0)
    const checkoutChangeCents = changeCents
    const checkoutOrderId = currentOrderId

    setAfterSaleError(null)
    setAfterSaleOrderId(null)
    setAfterSaleOrderNumber(currentOrderNumber)
    setAfterSaleSaving(true)
    setAfterSaleOpen(true)

    void (async () => {
      const customerSync = await ensureCustomerInCadastro()
      if (!customerSync.ok) {
        toast({
          title: 'Não foi possível cadastrar o cliente',
          description: String(customerSync.error || 'A venda seguirá mesmo assim.'),
          variant: 'destructive',
        })
      } else if ('created' in customerSync && customerSync.created) {
        toast({ title: 'Cliente cadastrado', description: customerName.trim() })
      }

      const checkoutRes = await portalFetch('/api/portal/pdv/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderPayload,
          order_id: checkoutOrderId,
          payments: paymentPayload,
          change_cents: checkoutChangeCents,
        }),
      })
      const finalizeData = await checkoutRes?.json().catch(() => null)

      if (!finalizeData?.ok) {
        const errorTitle = finalizeData?.error === 'finance_sync_failed'
          ? 'Venda paga, mas não foi possível lançar no financeiro'
          : finalizeData?.error === 'db_error'
            ? 'Erro ao finalizar'
            : (finalizeData?.error || 'Erro ao finalizar')
        const errorDescription = finalizeData?.error === 'finance_sync_failed'
          ? 'Vincule cada forma de pagamento a uma carteira em Financeiro > Formas de pagamento.'
          : undefined
        setAfterSaleSaving(false)
        setAfterSaleError(errorDescription ? `${errorTitle}. ${errorDescription}` : String(errorTitle))
        toast({ title: errorTitle, description: errorDescription, variant: 'destructive' })
        return
      }

      const finalOrderId = String(finalizeData.order_id || finalizeData.order?.id || '')
      setAfterSaleOrderId(finalOrderId || null)
      setAfterSaleOrderNumber(finalizeData.order.order_number ?? null)
      setAfterSaleSaving(false)
      setAfterSaleError(null)
      resetDraft()
      void loadSessionOrders()
    })()
  }

  useEffect(() => {
    function onKeyDown (event: KeyboardEvent) {
      const key = event.key
      const isFunctionKey = /^F\d{1,2}$/.test(key)
      const target = event.target as HTMLElement | null
      const tag = String(target?.tagName || '').toLowerCase()
      const isTypingField = tag === 'input' || tag === 'textarea' || tag === 'select'
        || Boolean(target?.isContentEditable)

      // Em campos de texto, só atalhos de função / Alt / Esc (não letras).
      if (isTypingField && !isFunctionKey && !event.altKey && key !== 'Escape') {
        return
      }

      if (event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setActiveTab('produto')
        return
      }
      if (event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setActiveTab('pagamento')
        return
      }

      if (key === 'F2') {
        event.preventDefault()
        setActiveTab('produto')
        requestAnimationFrame(() => document.getElementById('pdv-search')?.focus())
        return
      }
      if (key === 'F3') {
        event.preventDefault()
        setActiveTab('produto')
        requestAnimationFrame(() => {
          const el = document.getElementById('pdv-qty') as HTMLInputElement | null
          el?.focus()
          el?.select()
        })
        return
      }
      if (key === 'F4') {
        event.preventDefault()
        setActiveTab('pagamento')
        return
      }
      if (key === 'F5') {
        event.preventDefault()
        setActiveTab('pagamento')
        requestAnimationFrame(() => document.getElementById('pdv-customer-document')?.focus())
        return
      }
      if (key === 'F6') {
        event.preventDefault()
        finalizeOrder()
        return
      }
      if (key === 'F7') {
        event.preventDefault()
        setActiveTab('pagamento')
        fillRemainingOnPaymentLine(0)
        if (payments.some((p) => p.payment_method_type === 'dinheiro') || hasCashPayment) {
          setCashReceivedQuick(Math.max(cashPaidCents, totalCents))
        }
        toast({ title: 'Valor exato aplicado no pagamento' })
        return
      }
      if (key === 'F9') {
        event.preventDefault()
        startNewSale()
        return
      }
      if (key === 'Escape') {
        setQuery('')
        setShowSearchDropdown(false)
        cancelCartLineEdit()
        return
      }
      if (event.ctrlKey && key === 'Backspace') {
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
          <span className='hidden text-[11px] opacity-75 lg:inline'>
            F2 busca · F3 qtd · F4 pag. · F5 cliente · F6 finalizar · F7 exato · F9 nova
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            size='sm'
            onClick={() => startNewSale()}
            disabled={!cashOpen || busy}
          >
            Nova venda
          </Button>
          <Link href='/portal/vendas'>
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
                <DropdownMenuItem
                  disabled={syncingCatalog}
                  onClick={() => syncCatalogNow()}
                >
                  {syncingCatalog ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <RefreshCw className='mr-2 h-4 w-4' />
                  )}
                  Sincronizar produtos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSangriaOpen(true)}>Sangria</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSuprimentoOpen(true)}>Suprimento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCloseCashOpen(true)}>Fechar caixa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant='secondary'
              size='sm'
              disabled={loadingCash}
              onClick={() => setShowOpenCashModal(true)}
            >
              Abrir caixa
            </Button>
          )}
        </div>
      </header>

      <div className='relative grid min-h-0 flex-1 grid-cols-12 gap-0 overflow-hidden rounded-b-xl'>
        {!cashOpen && !loadingCash ? (
          <div className='absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-[1px]'>
            <div className='mx-4 flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center shadow-sm'>
              <h2 className='text-lg font-semibold'>Caixa fechado</h2>
              <p className='text-sm text-muted-foreground'>
                Abra o caixa para iniciar vendas, lançar pagamentos e registrar movimentos.
              </p>
              <Button onClick={() => setShowOpenCashModal(true)}>
                Reabrir caixa
              </Button>
            </div>
          </div>
        ) : null}
        {/* Produto + carrinho + ações da venda */}
        <div className='col-span-10 flex min-h-0 flex-col overflow-hidden border-r'>
          <div className='grid min-h-0 flex-1 grid-cols-2'>
            {/* Coluna esquerda — abas */}
            <div className='flex flex-col overflow-hidden border-r'>
          <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-1 flex-col overflow-hidden'>
            <TabsList className='mx-3 mt-3 grid w-auto grid-cols-2'>
              <TabsTrigger value='produto'>Produto</TabsTrigger>
              <TabsTrigger value='pagamento'>Pagamento</TabsTrigger>
            </TabsList>

            <TabsContent value='produto' className='flex min-h-0 flex-1 flex-col overflow-hidden p-4 data-[state=inactive]:hidden'>
              <div className='mb-3 shrink-0'>
                <Label className='text-xs text-muted-foreground'>Mais vendidos</Label>
                {loadingTopProducts && topProducts.length === 0 ? (
                  <div className='mt-1 flex h-16 items-center justify-center rounded-md border border-dashed bg-muted/30'>
                    <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                  </div>
                ) : topProducts.length === 0 ? (
                  <p className='mt-1 text-xs text-muted-foreground'>Nenhum produto cadastrado</p>
                ) : (
                  <div className='mt-1 grid grid-cols-5 gap-1'>
                    {topProducts.slice(0, 5).map((product, index) => (
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
                    {loadingProducts ? <Loader2 className='h-4 w-4 animate-spin' /> : <Barcode className='h-4 w-4' />}
                  </span>
                  <input
                    id='pdv-search'
                    type='text'
                    placeholder='Código de barras, SKU ou nome (F2 · Enter)'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setShowSearchDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleSearchSubmit()
                      }
                    }}
                    autoComplete='off'
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
                        onClick={() => {
                          selectProduct(product)
                          setSearchResults([])
                        }}
                      >
                        <div className='font-medium'>{product.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {[
                            isCatalogService(product) ? 'Serviço' : null,
                            product.sku || (isCatalogService(product) ? null : '—'),
                            maskedFromCents(product.sale_price_cents || 0),
                          ].filter(Boolean).join(' · ')}
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
                      inputId='pdv-qty'
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
                  onClick={() => insertItem()}
                  disabled={!selectedProduct || !cashOpen}
                >
                  {editingCartLineId ? 'Salvar' : 'Inserir'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='pagamento' className='flex-1 overflow-auto p-4 data-[state=inactive]:hidden'>
              <div className='space-y-3'>
                <div className='grid gap-3 sm:grid-cols-[minmax(10rem,12.5rem)_1fr]'>
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <div className='relative mt-1'>
                      <Input
                        id='pdv-customer-document'
                        value={customerDocument}
                        onChange={(e) => {
                          setCustomerId(null)
                          setCustomerDocument(formatCpfCnpj(e.target.value))
                        }}
                        placeholder='000.000.000-00'
                        inputMode='numeric'
                        autoComplete='off'
                      />
                      {loadingCustomerDoc ? (
                        <span className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2'>
                          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div ref={customerSearchRef} className='relative'>
                    <Label>Nome</Label>
                    <div className='relative mt-1'>
                      <Input
                        id='pdv-customer-name'
                        value={customerName}
                        onChange={(e) => {
                          setCustomerId(null)
                          setCustomerName(e.target.value)
                        }}
                        onFocus={() => {
                          if (customerMatches.length > 0) setShowCustomerDropdown(true)
                        }}
                        autoComplete='off'
                        placeholder='Consumidor Final ou busque no cadastro'
                        className={cn(
                          (loadingCustomers || customerId) && 'pr-9',
                        )}
                      />
                      {loadingCustomers ? (
                        <span className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2'>
                          <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                        </span>
                      ) : customerId ? (
                        <UserCheck
                          className='pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400'
                          aria-label='Cliente vinculado ao cadastro'
                        />
                      ) : null}
                    </div>
                    {showCustomerDropdown && customerMatches.length > 0 ? (
                      <div className='absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md'>
                        {customerMatches.map((match) => (
                          <button
                            key={match.id}
                            type='button'
                            className='block w-full px-3 py-2 text-left text-sm hover:bg-accent'
                            onClick={() => applyCustomerFromCadastro(match.raw)}
                          >
                            <div className='font-medium'>
                              {match.document || 'Sem documento'}
                              <span className='ml-2 font-normal text-muted-foreground'>{match.label}</span>
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {match.isCompany ? 'Pessoa jurídica' : 'Pessoa física'}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <hr className='!my-5 border-border' />

                <div className='space-y-3'>
                  <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Totais</p>
                  <div className='grid gap-3 sm:grid-cols-3'>
                    <div>
                      <Label>Sub total</Label>
                      <Input
                        className='mt-1'
                        readOnly
                        disabled
                        value={maskedFromCents(subtotalCents)}
                        tabIndex={-1}
                      />
                    </div>
                    <div>
                      <Label>Desconto</Label>
                      <div className='mt-1'>
                        <DiscountField
                          value={discountTotalMasked}
                          onChange={setDiscountTotalMasked}
                          mode={orderDiscountMode}
                          onModeToggle={() => {
                            setOrderDiscountMode((m) => m === 'fixed' ? 'percent' : 'fixed')
                            setDiscountTotalMasked('')
                          }}
                          disabled={!hasCartItems}
                          ariaLabel='Desconto'
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Cobrança adicional</Label>
                      <Input
                        className='mt-1'
                        value={surchargeMasked}
                        onChange={(e) => setSurchargeMasked(formatMoneyInput(e.target.value))}
                        placeholder='0,00'
                        disabled={!hasCartItems}
                      />
                    </div>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-3'>
                    <div>
                      <Label>Recebido em dinheiro</Label>
                      <Input
                        className='mt-1'
                        value={cashReceivedMasked}
                        onChange={(e) => setCashReceivedMasked(formatMoneyInput(e.target.value))}
                        placeholder='0,00'
                        disabled={!hasCartItems || !hasCashPayment}
                      />
                    </div>
                    <div>
                      <Label>Troco em dinheiro</Label>
                      <Input
                        className='mt-1'
                        readOnly
                        disabled
                        value={maskedFromCents(changeCents)}
                        tabIndex={-1}
                      />
                    </div>
                    <div>
                      <Label>Total da venda</Label>
                      <Input
                        className='mt-1 font-semibold'
                        readOnly
                        disabled
                        value={maskedFromCents(totalCents)}
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                </div>

                <hr className='!my-5 border-border' />

                <div className='space-y-2'>
                  <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Forma de pagamento</p>
                  <div className='space-y-2'>
                    {payments.map((line, idx) => {
                      const selectedMethod = paymentMethods.find((m) => m.id === line.payment_method_id)
                      const isCredit = selectedMethod?.type === 'credito' || line.payment_method_type === 'credito'
                      const maxInstallments = maxCreditInstallments(selectedMethod)
                      return (
                      <div key={`${idx}-${line.payment_method_type}`} className='grid gap-1 sm:grid-cols-[1fr_auto]'>
                        <select
                          className='h-9 rounded border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60'
                          value={line.payment_method_id || ''}
                          disabled={!hasCartItems}
                          onChange={(e) => {
                            const id = e.target.value || null
                            const method = paymentMethods.find((m) => m.id === id)
                            const nextType = method ? normalizePaymentType(method.type) : line.payment_method_type
                            setPayments((prev) => {
                              let next = prev.map((row, index) => (
                                index === idx
                                  ? {
                                    ...row,
                                    payment_method_id: id,
                                    payment_method_type: nextType,
                                    installments: nextType === 'credito' ? Math.max(1, row.installments || 1) : 1,
                                  }
                                  : row
                              ))
                              const receivedCents = moneyToCentsFromMasked(cashReceivedMasked) || 0
                              if (receivedCents > 0 && next.some((p) => p.payment_method_type === 'dinheiro')) {
                                next = redistributeCashPaymentLine(next, totalCents)
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
                          {isCredit ? (
                            <select
                              className='h-9 w-[4.5rem] shrink-0 rounded border bg-background px-1 text-sm disabled:cursor-not-allowed disabled:opacity-60'
                              value={String(Math.min(line.installments || 1, maxInstallments))}
                              disabled={!hasCartItems}
                              aria-label='Parcelas'
                              onChange={(e) => setPaymentLine(idx, {
                                installments: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                              })}
                            >
                              {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={String(n)}>{n}x</option>
                              ))}
                            </select>
                          ) : null}
                          <Input
                            value={line.amountMasked}
                            onChange={(e) => setPaymentLine(idx, { amountMasked: formatMoneyInput(e.target.value) })}
                            onBlur={() => commitPaymentLineAmount(idx)}
                            placeholder='0,00'
                            disabled={!hasCartItems}
                          />
                          {payments.length > 1 ? (
                            <Button
                              variant='ghost'
                              size='icon'
                              disabled={!hasCartItems}
                              onClick={() => removePaymentLine(idx)}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      )
                    })}
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={!hasCartItems}
                      onClick={() => addPaymentLine()}
                    >
                      Adicionar pagamento
                    </Button>
                    {hasCartItems ? (
                      <div className={cn(
                        'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
                        paidCents > totalCents
                          ? 'border-destructive/50 bg-destructive/5 text-destructive'
                          : 'border-border bg-muted/30 text-foreground',
                      )}
                      >
                        <span className='inline-flex items-center gap-1.5 font-medium'>
                          {paidCents > totalCents ? (
                            <AlertCircle className='h-4 w-4 shrink-0 text-destructive' aria-hidden />
                          ) : null}
                          Total pago
                        </span>
                        <strong className='tabular-nums'>{maskedFromCents(paidCents)}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
            </div>

            {/* Coluna centro — carrinho */}
            <div className='relative flex min-h-0 flex-col overflow-hidden'>
          {loadingOrderId ? (
            <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-[1px]'>
              <Loader2 className='h-6 w-6 animate-spin text-primary' />
              <p className='text-sm text-muted-foreground'>Carregando pedido…</p>
            </div>
          ) : null}
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
                            onClick={() => void beginEditCartItem(item.lineId)}
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

          <div className='shrink-0 space-y-1.5 border-t bg-muted/20 px-4 py-3'>
            {discountTotalCents > 0 || surchargeCents > 0 ? (
              <>
                <div className='flex items-center justify-between text-sm text-muted-foreground'>
                  <span>Subtotal</span>
                  <span className='tabular-nums'>{maskedFromCents(subtotalCents)}</span>
                </div>
                {discountTotalCents > 0 ? (
                  <div className='flex items-center justify-between text-sm font-semibold'>
                    <span>Desconto</span>
                    <span className='tabular-nums'>− {maskedFromCents(discountTotalCents)}</span>
                  </div>
                ) : null}
                {surchargeCents > 0 ? (
                  <div className='flex items-center justify-between text-sm font-semibold'>
                    <span>Cobrança adicional</span>
                    <span className='tabular-nums'>+ {maskedFromCents(surchargeCents)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className={cn(
              'flex items-center justify-between',
              (discountTotalCents > 0 || surchargeCents > 0) && 'border-t pt-2',
            )}
            >
              <span className='text-base font-bold text-foreground'>Total</span>
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
            <Button
              onClick={() => finalizeOrder()}
              disabled={busy || afterSaleSaving || afterSaleOpen || !cashOpen || cart.length === 0}
            >
              {afterSaleSaving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
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
                  const isSelected = isActive && currentOrderId === order.id
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md border pl-3 pr-1 py-1.5 transition-colors',
                        orderStatusChromeClass(order.status, isSelected),
                      )}
                    >
                      <button
                        type='button'
                        disabled={!isActive || Boolean(loadingOrderId)}
                        onClick={() => void loadOrderIntoCart(order.id)}
                        className={cn(
                          'min-w-0 flex-1 text-left',
                          isActive ? 'cursor-pointer' : 'cursor-default',
                        )}
                      >
                        <div className='flex flex-col gap-0.5'>
                          <span className={cn('inline-flex items-center gap-1 font-semibold leading-none', isActive ? 'text-sm' : 'text-xs')}>
                            {loadingOrderId === order.id ? (
                              <Loader2 className='h-3 w-3 animate-spin' />
                            ) : null}
                            Pedido {order.order_number}
                          </span>
                          <span className={cn('text-[11px] tabular-nums leading-none', isActive ? 'font-medium' : 'opacity-80')}>
                            {maskedFromCents(order.total_cents)}
                          </span>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 shrink-0'
                            aria-label={`Ações do pedido ${order.order_number}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => void openSalesOrderCupomPrintLazy(order.id)}
                          >
                            {salesOrderCupomPrintLabel(order.status)}
                          </DropdownMenuItem>
                          {order.status === 'paid' ? (
                            <DropdownMenuItem
                              disabled={nfceBusyId === order.id}
                              onClick={() => {
                                if (order.nfce_status === 'authorized' && order.nfce_document_id) {
                                  void openNfceDanfePrintLazy(order.nfce_document_id)
                                  return
                                }
                                if (order.nfce_document_id && (
                                  order.nfce_status === 'rejected' ||
                                  order.nfce_status === 'denied'
                                )) {
                                  router.push(nfceEditorHref(order.nfce_document_id))
                                  return
                                }
                                void emitNfceForOrder(order)
                              }}
                            >
                              {nfceBusyId === order.id ? 'Gerando NFC-e…' : pdvNfceMenuLabel(order)}
                            </DropdownMenuItem>
                          ) : null}
                          {isActive || order.status === 'paid' ? (
                            <DropdownMenuItem
                              className='text-destructive focus:text-destructive'
                              disabled={busy}
                              onClick={() => void cancelOrderById(order.id, order.status)}
                            >
                              {order.status === 'paid' ? 'Estornar venda' : 'Cancelar'}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal abrir / reabrir caixa */}
      <Dialog
        open={showOpenCashModal && !loadingCash}
        onOpenChange={(open) => {
          if (!open) setShowOpenCashModal(false)
        }}
      >
        <DialogContent aria-describedby={undefined} className='sm:max-w-md'>
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
            <Button variant='outline' onClick={() => setShowOpenCashModal(false)}>
              Voltar
            </Button>
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

          <DialogFooter className='flex-col gap-2 sm:flex-row sm:justify-end'>
            <Button variant='outline' onClick={() => setCloseCashOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant='outline'
              onClick={printCloseReport}
              disabled={busy || loadingCloseSummary || !closeSummary}
            >
              Imprimir
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

      <SalesOrderAfterSaleDialog
        open={afterSaleOpen}
        onOpenChange={(open) => {
          setAfterSaleOpen(open)
          if (!open) {
            setAfterSaleSaving(false)
            setAfterSaleError(null)
          }
        }}
        orderId={afterSaleOrderId}
        orderNumber={afterSaleOrderNumber}
        saving={afterSaleSaving}
        error={afterSaleError}
      />
    </div>
  )
}
