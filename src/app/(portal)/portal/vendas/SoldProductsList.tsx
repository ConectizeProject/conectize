'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Eye, MoreHorizontal, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  emitSalesOrderFiscalDocument,
  emitServiceOrderNfce,
  emitServiceOrderNfe,
} from '@/lib/fiscal/emit-sales-order-client'
import { printPngBase64 } from '@/lib/vendas/print-label-image'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { VendasListFilters, type VendasFilterMethod, type VendasFilterUser } from '@/app/(portal)/portal/vendas/VendasListFilters'
import { VendasListPagination } from '@/app/(portal)/portal/vendas/VendasListPagination'
import { VendasRealizadasHeader } from '@/app/(portal)/portal/vendas/VendasRealizadasHeader'
import { VENDAS_LIST_PAGE_SIZE } from '@/lib/vendas/list-pagination'
import { parseSalesLane, type SalesLane } from '@/lib/vendas/sales-lane'
import {
  salesListSectionFromPath,
  salesListSessionRedirectTarget,
  writeSalesListSession,
} from '@/lib/vendas/sales-list-session'
import { isSafeProductListImageUrl } from '@/app/(portal)/portal/produtos/product-list-shared'
import { useProductEditDialog } from '@/components/products/product-edit-dialog'
import {
  SalesOrderListRow,
  type SalesOrderListLine,
  type SalesOrderListRowData,
} from '@/app/(portal)/portal/vendas/SalesOrderListRow'
import { groupSoldItemsByCart, mergeSameProductLines } from '@/lib/vendas/group-sold-items-by-cart'
import {
  SalesOrdersCardListSkeleton,
  VendasListLoadingOverlay,
} from '@/app/(portal)/portal/vendas/VendasListLoading'
import { type SoldItemMarginBreakdownData } from '@/app/(portal)/portal/vendas/SoldItemMarginBreakdown'

type SoldItem = {
  id: string
  source?: 'sale' | 'service_order'
  productId: string | null
  productName: string
  productSku: string | null
  productImageUrl: string | null
  quantity: number
  unitPriceCents: number
  lineUnitCostCents: number
  productCostCents: number | null
  subtotalCents: number
  createdAt: string
  order: {
    id: string
    orderNumber: number
    createdAt: string
    totalCents: number
    status?: string | null
    mlOrderId: string | null
    mlPackId: string | null
    customerName: string | null
    href?: string | null
    label?: string | null
  }
  card?: {
    status?: string | null
    statusLabel?: string | null
    allowNfe?: boolean
    buyerName?: string | null
    buyerNickname?: string | null
    logisticType?: string | null
    shippingGrossCents?: number | null
    shippingRefundCents?: number | null
    saleFeeCents?: number | null
    postingDeadline?: string | null
    deliveryEstimate?: string | null
    shippingMethod?: string | null
    labelStatus?: string | null
    labelAvailableAt?: string | null
    labelPrintable?: boolean | null
    claimStatus?: string | null
    taxCents?: number | null
    costTotalCents?: number | null
    stockCurrent?: number | null
    stockAfterSale?: number | null
    nfeStatus?: string | null
    nfeDocumentId?: string | null
    nfceStatus?: string | null
    nfceDocumentId?: string | null
    hasFinancePosted?: boolean
    hasStockPosted?: boolean
    meliNfeAuthorized?: boolean | null
    meliNfeId?: string | null
    mlItemId?: string | null
    mlItemUrl?: string | null
    shipmentId?: string | null
  } | null
  margin: SoldItemMarginBreakdownData & {
    effectiveUnitCostCents: number | null
  }
}

function orderStatus (value: string | null | undefined): SalesOrderListRowData['status'] {
  if (value === 'in_progress' || value === 'paid' || value === 'canceled') return value
  return 'paid'
}

function nfeStatus (value: string | null | undefined): SalesOrderListRowData['nfe_status'] {
  if (
    value === 'pending'
    || value === 'authorized'
    || value === 'rejected'
    || value === 'canceled'
    || value === 'denied'
  ) return value
  return null
}

function mergeSoldItemDuplicates (kept: SoldItem, extra: SoldItem): SoldItem {
  const quantity = kept.quantity + extra.quantity
  const subtotalCents = kept.subtotalCents + extra.subtotalCents
  const revenueCents = kept.margin.revenueCents + extra.margin.revenueCents
  const contributionMarginCents =
    kept.margin.contributionMarginCents + extra.margin.contributionMarginCents
  const feeByLabel = new Map<string, number>()
  for (const detail of [...kept.margin.feeDetails, ...extra.margin.feeDetails]) {
    const label = String(detail.label || '').trim() || 'Tarifa'
    feeByLabel.set(label, (feeByLabel.get(label) || 0) + Math.max(0, Number(detail.amountCents) || 0))
  }
  return {
    ...kept,
    quantity,
    subtotalCents,
    margin: {
      ...kept.margin,
      revenueCents,
      shippingCents: kept.margin.shippingCents + extra.margin.shippingCents,
      feeCents: kept.margin.feeCents + extra.margin.feeCents,
      feeDetails: [...feeByLabel.entries()].map(([label, amountCents]) => ({
        label,
        amountCents,
      })),
      costTotalCents: kept.margin.costTotalCents + extra.margin.costTotalCents,
      grossProfitCents: kept.margin.grossProfitCents + extra.margin.grossProfitCents,
      taxCents: kept.margin.taxCents + extra.margin.taxCents,
      contributionMarginCents,
      contributionMarginPercent: revenueCents > 0
        ? (contributionMarginCents / revenueCents) * 100
        : null,
      canEditCost: kept.margin.canEditCost || extra.margin.canEditCost,
    },
    card: kept.card || extra.card
      ? {
        ...extra.card,
        ...kept.card,
        shippingGrossCents: (Number(kept.card?.shippingGrossCents) || 0)
          + (Number(extra.card?.shippingGrossCents) || 0),
        shippingRefundCents: (Number(kept.card?.shippingRefundCents) || 0)
          + (Number(extra.card?.shippingRefundCents) || 0),
        saleFeeCents: (Number(kept.card?.saleFeeCents) || 0)
          + (Number(extra.card?.saleFeeCents) || 0),
        taxCents: (Number(kept.card?.taxCents) || 0) + (Number(extra.card?.taxCents) || 0),
        costTotalCents: (Number(kept.card?.costTotalCents) || 0)
          + (Number(extra.card?.costTotalCents) || 0),
      }
      : kept.card,
  }
}

function productCardOrder (item: SoldItem): SalesOrderListRowData {
  const card = item.card
  const imageUrl = item.productImageUrl && isSafeProductListImageUrl(item.productImageUrl)
    ? item.productImageUrl
    : null
  return {
    id: item.order.id,
    order_number: item.order.orderNumber,
    status: orderStatus(card?.status || item.order.status),
    customer_name: item.order.customerName,
    total_cents: item.subtotalCents,
    created_at: item.order.createdAt || item.createdAt,
    ml_order_id: item.order.mlOrderId,
    ml_pack_id: item.order.mlPackId,
    ml_logistic_type: card?.logisticType ?? null,
    ml_buyer_name: card?.buyerName || item.order.customerName,
    ml_buyer_nickname: card?.buyerNickname ?? null,
    ml_shipping_gross_cents: card?.shippingGrossCents ?? item.margin.shippingCents,
    ml_shipping_refund_cents: card?.shippingRefundCents ?? 0,
    ml_sale_fee_cents: card?.saleFeeCents ?? item.margin.feeCents,
    ml_posting_deadline: card?.postingDeadline ?? null,
    ml_delivery_estimate: card?.deliveryEstimate ?? null,
    ml_shipping_method: card?.shippingMethod ?? null,
    ml_label_status: card?.labelStatus ?? null,
    ml_label_available_at: card?.labelAvailableAt ?? null,
    ml_label_printable: card?.labelPrintable === true,
    ml_claim_status: card?.claimStatus ?? null,
    ml_shipment_id: card?.shipmentId ?? null,
    tax_cents: card?.taxCents ?? item.margin.taxCents,
    nfe_status: nfeStatus(card?.nfeStatus),
    nfe_document_id: card?.nfeDocumentId ?? null,
    nfce_status: nfeStatus(card?.nfceStatus),
    nfce_document_id: card?.nfceDocumentId ?? null,
    has_finance_posted: card?.hasFinancePosted === true,
    has_stock_posted: card?.hasStockPosted === true,
    meli_nfe_authorized: card?.meliNfeAuthorized === true,
    title: item.order.label || null,
    status_label: card?.statusLabel ?? null,
    allow_nfe: card?.allowNfe !== false,
    items: [{
      product_id: item.productId,
      name: item.productName,
      sku: item.productSku,
      image_url: imageUrl,
      quantity: item.quantity,
      unit_price_cents: item.subtotalCents,
      cost_total_cents: item.margin.costTotalCents,
      stock_current: card?.stockCurrent ?? null,
      stock_after_sale: card?.stockAfterSale ?? null,
      ml_item_id: card?.mlItemId ?? null,
      ml_item_url: card?.mlItemUrl ?? null,
      ml_order_id: item.order.mlOrderId,
    }],
  }
}

function parseSalesDateParam (value: string | null): string {
  const parsed = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : ''
}

function initialCostMasked (item: SoldItem) {
  const initial =
    item.margin.effectiveUnitCostCents != null
      ? item.margin.effectiveUnitCostCents
      : item.productCostCents && item.productCostCents > 0
        ? item.productCostCents
        : 0
  return maskedFromCents(initial)
}

function SoldItemCostDialog ({
  item,
  onClose,
  onSaved,
}: {
  item: SoldItem | null
  onClose: () => void
  onSaved: (input: {
    itemId: string
    unitCostCents: number
    scope: 'sale' | 'sale_and_product'
    margin: SoldItem['margin']
  }) => void
}) {
  const [costMasked, setCostMasked] = useState('')
  const [costScope, setCostScope] = useState<'sale' | 'sale_and_product'>('sale')
  const [savingCost, setSavingCost] = useState(false)
  const itemId = item?.id ?? null

  useEffect(() => {
    if (!item) return
    setCostMasked(initialCostMasked(item))
    setCostScope('sale')
    setSavingCost(false)
  }, [itemId])

  async function saveCost () {
    if (!item) return
    const parsed = moneyToCentsFromMasked(costMasked)
    if (parsed == null) {
      toast({
        title: 'Custo inválido',
        description: 'Informe um valor em reais no formato 0,00.',
        variant: 'destructive',
      })
      return
    }
    setSavingCost(true)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/sold-items/${encodeURIComponent(item.id)}/cost`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitCostCents: parsed,
            scope: costScope,
          }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível atualizar o custo.')
      }
      onSaved({
        itemId: item.id,
        unitCostCents: parsed,
        scope: costScope,
        margin: data.margin as SoldItem['margin'],
      })
      toast({
        title: 'Custo atualizado',
        description:
          costScope === 'sale_and_product'
            ? 'Atualizado neste item e no cadastro do produto.'
            : item.source === 'service_order'
              ? 'Atualizado somente nesta linha da OS.'
              : 'Atualizado somente nesta venda.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar custo',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingCost(false)
    }
  }

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open && !savingCost) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar custo</DialogTitle>
          <DialogDescription>
            {item
              ? `Defina o custo unitário de «${item.productName}».`
              : 'Defina o custo unitário.'}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='sold-item-cost'>Custo unitário (R$)</Label>
            <Input
              id='sold-item-cost'
              inputMode='decimal'
              value={costMasked}
              onChange={(e) => setCostMasked(formatMoneyInput(e.target.value))}
              disabled={savingCost}
              autoComplete='off'
            />
          </div>
          <RadioGroup
            value={costScope}
            onValueChange={(v) => {
              if (v === 'sale' || v === 'sale_and_product') setCostScope(v)
            }}
            disabled={savingCost}
            className='gap-3'
          >
            <label className='flex cursor-pointer items-start gap-2 text-sm'>
              <RadioGroupItem value='sale' id='cost-scope-sale' className='mt-0.5' />
              <span>
                <span className='font-medium'>
                  {item?.source === 'service_order' ? 'Só esta OS' : 'Só esta venda'}
                </span>
                <span className='mt-0.5 block text-xs text-muted-foreground'>
                  {item?.source === 'service_order'
                    ? 'Atualiza o custo apenas nesta linha da ordem de serviço.'
                    : 'Atualiza o custo apenas nesta linha do pedido.'}
                </span>
              </span>
            </label>
            <label className='flex cursor-pointer items-start gap-2 text-sm'>
              <RadioGroupItem
                value='sale_and_product'
                id='cost-scope-both'
                className='mt-0.5'
              />
              <span>
                <span className='font-medium'>Item e produto</span>
                <span className='mt-0.5 block text-xs text-muted-foreground'>
                  Atualiza este item e o custo no cadastro do produto.
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={savingCost}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type='button' disabled={savingCost} onClick={() => void saveCost()}>
            {savingCost ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SoldProductsList () {
  const router = useRouter()
  const pathname = usePathname() || '/portal/vendas/produtos'
  const searchParams = useSearchParams()
  const isActiveList = salesListSectionFromPath(pathname) === 'produtos'
  const page = Math.max(1, Number.parseInt(String(searchParams.get('page') || '1'), 10) || 1)
  const urlFrom = parseSalesDateParam(searchParams.get('from'))
  const urlTo = parseSalesDateParam(searchParams.get('to'))
  const urlLane = parseSalesLane(searchParams.get('lane')) ?? 'all'

  const [items, setItems] = useState<SoldItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [from, setFrom] = useState(urlFrom)
  const [to, setTo] = useState(urlTo)
  const [sellerUserId, setSellerUserId] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [marketplaceOrder, setMarketplaceOrder] = useState('')
  const [teamUsers, setTeamUsers] = useState<VendasFilterUser[]>([])
  const [paymentMethods, setPaymentMethods] = useState<VendasFilterMethod[]>([])
  const [editItem, setEditItem] = useState<SoldItem | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [printingLabelOrderId, setPrintingLabelOrderId] = useState<string | null>(null)
  const [labelPreview, setLabelPreview] = useState<{
    title: string
    pngBase64: string
    zpl: string
  } | null>(null)

  const load = useCallback(async (
    pageNum: number,
    overrides?: {
      from?: string
      to?: string
      lane?: SalesLane
      sellerUserId?: string
      paymentMethodId?: string
      marketplaceOrder?: string
    },
  ) => {
    setLoading(true)
    try {
      const nextFrom = overrides?.from ?? urlFrom
      const nextTo = overrides?.to ?? urlTo
      const nextLane = overrides?.lane ?? urlLane
      const nextSeller = overrides?.sellerUserId ?? sellerUserId
      const nextPayment = overrides?.paymentMethodId ?? paymentMethodId
      const nextMarketplace = overrides?.marketplaceOrder ?? marketplaceOrder
      const params = new URLSearchParams()
      params.set('page', String(pageNum))
      if (nextFrom) params.set('from', nextFrom)
      if (nextTo) params.set('to', nextTo)
      if (nextLane !== 'all') params.set('lane', nextLane)
      if (nextSeller) params.set('seller_user_id', nextSeller)
      if (nextPayment) params.set('payment_method_id', nextPayment)
      const marketplaceDigits = nextMarketplace.replace(/\D/g, '')
      if (marketplaceDigits) params.set('ml_order', marketplaceDigits)
      const res = await portalFetch(`/api/portal/sales-orders/sold-items?${params.toString()}`)
      if (!res) {
        throw new Error('Não foi possível carregar os produtos vendidos.')
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || 'Não foi possível carregar os produtos vendidos.')
      }
      setItems(Array.isArray(data.items) ? (data.items as SoldItem[]) : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      setItems([])
      setTotal(0)
      toast({
        title: 'Erro ao carregar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [marketplaceOrder, paymentMethodId, sellerUserId, urlFrom, urlLane, urlTo])

  const productEdit = useProductEditDialog({
    onSuccess: () => {
      void load(page)
    },
    onStockChange: (productId, currentStock) => {
      setItems((prev) => prev.map((item) => {
        if (item.productId !== productId || !item.card) return item
        return {
          ...item,
          card: {
            ...item.card,
            stockCurrent: currentStock,
            stockAfterSale: currentStock,
          },
        }
      }))
    },
  })

  useEffect(() => {
    let cancelled = false
    async function loadCatalogs () {
      const [teamRes, methodsRes] = await Promise.all([
        portalFetch('/api/portal/team-users'),
        portalFetch('/api/portal/payment-methods'),
      ])
      const teamData = await teamRes?.json().catch(() => null)
      const methodsData = await methodsRes?.json().catch(() => null)
      if (cancelled) return
      if (teamData?.ok && Array.isArray(teamData.users)) {
        setTeamUsers(teamData.users as VendasFilterUser[])
      }
      if (methodsData?.ok && Array.isArray(methodsData.paymentMethods)) {
        setPaymentMethods(
          (methodsData.paymentMethods as Array<{ id?: string, description?: string }>)
            .filter((method) => Boolean(method.id))
            .map((method) => ({
              id: String(method.id),
              description: String(method.description || 'Método').trim() || 'Método',
            })),
        )
      }
    }
    void loadCatalogs()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isActiveList) return
    if (salesListSessionRedirectTarget(pathname, searchParams.toString())) return
    setFrom(urlFrom)
    setTo(urlTo)
    void load(page)
  }, [isActiveList, load, page, pathname, searchParams, urlFrom, urlTo])

  function replaceQuery (next: {
    from?: string
    to?: string
    lane?: SalesLane
    page?: number
  }) {
    const params = new URLSearchParams(searchParams.toString())
    const nextFrom = next.from ?? urlFrom
    const nextTo = next.to ?? urlTo
    const nextLane = next.lane ?? urlLane
    const nextPage = next.page ?? 1
    if (nextFrom) params.set('from', nextFrom)
    else params.delete('from')
    if (nextTo) params.set('to', nextTo)
    else params.delete('to')
    if (nextLane === 'all') params.delete('lane')
    else params.set('lane', nextLane)
    if (nextPage <= 1) params.delete('page')
    else params.set('page', String(nextPage))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function selectLane (next: SalesLane) {
    writeSalesListSession({ section: 'produtos', lane: next })
    replaceQuery({ lane: next, page: 1 })
  }

  function applyFilters () {
    replaceQuery({ from, to, page: 1 })
    void load(1, { from, to, sellerUserId, paymentMethodId, marketplaceOrder })
  }

  function clearFilters () {
    setFrom('')
    setTo('')
    setSellerUserId('')
    setPaymentMethodId('')
    setMarketplaceOrder('')
    writeSalesListSession({ section: 'produtos', lane: 'all' })
    replaceQuery({ from: '', to: '', lane: 'all', page: 1 })
    void load(1, {
      from: '',
      to: '',
      lane: 'all',
      sellerUserId: '',
      paymentMethodId: '',
      marketplaceOrder: '',
    })
  }

  const hasActiveFilters = Boolean(from || to || urlLane !== 'all' || sellerUserId || paymentMethodId || marketplaceOrder.trim())

  function setPage (next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function sendToBling (item: SoldItem) {
    if (!item.order.id || item.source === 'service_order') return
    setBusyOrderId(item.order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(item.order.id)}/send-to-bling`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Erro ao enviar ao Bling',
          description: data?.message || data?.error || 'Não foi possível enviar o pedido.',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: data.already_synced ? 'Pedido já vinculado ao Bling' : 'Pedido enviado ao Bling',
      })
      const url = data.preferred_url || data.pedido_url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusyOrderId(null)
    }
  }

  function downloadBlobFile (blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function downloadTextFile (content: string, filename: string) {
    downloadBlobFile(
      new Blob([content], { type: 'text/plain;charset=utf-8' }),
      filename.endsWith('.zpl') ? filename : `${filename}.zpl`,
    )
  }

  function downloadPdfBase64 (pdfBase64: string, filename: string) {
    const binary = atob(pdfBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    downloadBlobFile(
      new Blob([bytes], { type: 'application/pdf' }),
      filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    )
  }

  async function openMeliLabelPreview (item: SoldItem) {
    if (!item.order.id || item.source === 'service_order') return
    setPrintingLabelOrderId(item.order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(item.order.id)}/meli-label`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'preview' }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok || typeof data.pngBase64 !== 'string') {
        toast({
          title: 'Não foi possível abrir a etiqueta',
          description: data?.message || data?.error || 'Tente novamente em instantes.',
          variant: 'destructive',
        })
        return
      }
      setLabelPreview({
        title: item.order.label || `Pedido #${item.order.orderNumber}`,
        pngBase64: data.pngBase64,
        zpl: typeof data.zpl === 'string' ? data.zpl : '',
      })
    } finally {
      setPrintingLabelOrderId(null)
    }
  }

  async function downloadMeliLabel (
    item: SoldItem,
    kind: 'custom' | 'original' | 'pdf',
  ) {
    if (!item.order.id || item.source === 'service_order') return
    setPrintingLabelOrderId(item.order.id)
    try {
      const mode = kind === 'custom'
        ? 'zpl_custom'
        : kind === 'original'
          ? 'zpl_original'
          : 'pdf'
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(item.order.id)}/meli-label`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Não foi possível baixar a etiqueta',
          description: data?.message || data?.error || 'Tente novamente em instantes.',
          variant: 'destructive',
        })
        return
      }

      if (kind === 'pdf') {
        if (typeof data.pdfBase64 !== 'string') {
          toast({
            title: 'Não foi possível baixar o PDF',
            description: 'Resposta inválida do servidor.',
            variant: 'destructive',
          })
          return
        }
        downloadPdfBase64(
          data.pdfBase64,
          String(data.filename || `etiqueta-meli-${item.order.orderNumber || item.order.id}.pdf`),
        )
        toast({ title: 'PDF baixado' })
        return
      }

      if (typeof data.zpl !== 'string') {
        toast({
          title: 'Não foi possível baixar o ZPL',
          description: 'Resposta inválida do servidor.',
          variant: 'destructive',
        })
        return
      }
      downloadTextFile(
        data.zpl,
        String(data.filename || `etiqueta-meli-${item.order.orderNumber || item.order.id}.zpl`),
      )
      toast({
        title: kind === 'custom'
          ? 'ZPL customizado baixado'
          : 'ZPL do Mercado Livre baixado',
      })
    } finally {
      setPrintingLabelOrderId(null)
    }
  }

  async function emitNfe (item: SoldItem) {
    if (!item.order.id) return
    setBusyOrderId(item.order.id)
    try {
      const result = item.source === 'service_order'
        ? await emitServiceOrderNfe({
          orderId: item.order.id,
          displayNumber: item.order.orderNumber,
          navigate: (href) => router.push(href),
        })
        : await emitSalesOrderFiscalDocument({
          orderId: item.order.id,
          model: '55',
          paid: true,
          navigate: (href) => router.push(href),
        })
      const nextDocument = result.fiscalDocument
      if (nextDocument?.id) {
        setItems((prev) => prev.map((row) => (
          row.order.id === item.order.id
            ? {
              ...row,
              card: {
                ...row.card,
                nfeStatus: nextDocument.status || row.card?.nfeStatus,
                nfeDocumentId: nextDocument.id,
              },
            }
            : row
        )))
      }
    } finally {
      setBusyOrderId(null)
    }
  }

  async function emitNfce (item: SoldItem) {
    if (!item.order.id) return
    setBusyOrderId(item.order.id)
    try {
      const result = item.source === 'service_order'
        ? await emitServiceOrderNfce({
          orderId: item.order.id,
          displayNumber: item.order.orderNumber,
          navigate: (href) => router.push(href),
        })
        : await emitSalesOrderFiscalDocument({
          orderId: item.order.id,
          model: '65',
          paid: true,
          navigate: (href) => router.push(href),
        })
      const nextDocument = result.fiscalDocument
      if (nextDocument?.id) {
        setItems((prev) => prev.map((row) => (
          row.order.id === item.order.id
            ? {
              ...row,
              card: {
                ...row.card,
                nfceStatus: nextDocument.status || row.card?.nfceStatus,
                nfceDocumentId: nextDocument.id,
              },
            }
            : row
        )))
      }
    } finally {
      setBusyOrderId(null)
    }
  }

  function openCostEditor (item: SoldItem) {
    if (!item.margin.canEditCost) return
    setEditItem(item)
  }

  function applyCostUpdate (input: {
    itemId: string
    unitCostCents: number
    scope: 'sale' | 'sale_and_product'
    margin: SoldItem['margin']
  }) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== input.itemId) return row
        return {
          ...row,
          lineUnitCostCents: input.unitCostCents,
          productCostCents:
            input.scope === 'sale_and_product' ? input.unitCostCents : row.productCostCents,
          margin: input.margin,
          card: row.card
            ? { ...row.card, costTotalCents: input.margin.costTotalCents }
            : row.card,
        }
      }),
    )
  }

  return (
    <>
      <div className='space-y-4'>
        <VendasRealizadasHeader
          lane={urlLane}
          onLaneChange={selectLane}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
        />
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start'>
          {filtersOpen ? (
            <VendasListFilters
              idPrefix='produtos-filter'
              from={from}
              to={to}
              sellerUserId={sellerUserId}
              paymentMethodId={paymentMethodId}
              marketplaceOrder={marketplaceOrder}
              teamUsers={teamUsers}
              paymentMethods={paymentMethods}
              isLoading={loading}
              canClear={hasActiveFilters}
              onFromChange={setFrom}
              onToChange={setTo}
              onSellerChange={setSellerUserId}
              onPaymentChange={setPaymentMethodId}
              onMarketplaceOrderChange={setMarketplaceOrder}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          ) : null}
          <Card className='min-w-0 flex-1'>
        <CardContent className='space-y-3 p-0 sm:p-0'>
          {loading ? (
            <div className='relative min-h-48' aria-busy='true' aria-live='polite'>
              <div className='pointer-events-none select-none opacity-70'>
                <SalesOrdersCardListSkeleton count={10} />
              </div>
              <VendasListLoadingOverlay label='Carregando vendas…' />
              <span className='sr-only'>Carregando vendas</span>
            </div>
          ) : items.length === 0 ? (
            <p className='px-4 py-8 text-sm text-muted-foreground'>
              Nenhum produto vendido encontrado.
            </p>
          ) : (
            <TooltipProvider>
              {groupSoldItemsByCart(items).map((group, groupIndex, groups) => {
                const lines: SalesOrderListLine[] = mergeSameProductLines(
                  group,
                  mergeSoldItemDuplicates,
                ).map((item) => {
                  const orderHref =
                    item.order.href
                    || (item.source === 'service_order' && item.order.orderNumber > 0
                      ? `/portal/ordens/${encodeURIComponent(String(item.order.orderNumber))}`
                      : item.order.id
                        ? `/portal/vendas/${encodeURIComponent(item.order.id)}`
                        : null)
                  const orderLabel =
                    item.order.label
                    || (item.source === 'service_order'
                      ? `OS #${item.order.orderNumber || '—'}`
                      : `Pedido #${item.order.orderNumber}`)

                  return {
                    order: productCardOrder(item),
                    isBusy: busyOrderId === item.order.id,
                    onEmitNfe: () => {
                      void emitNfe(item)
                    },
                    onViewNfe: () => {
                      const documentId = item.card?.nfeDocumentId
                      if (documentId) {
                        router.push(`/portal/vendas/nfe/${encodeURIComponent(documentId)}`)
                        return
                      }
                      if (item.card?.meliNfeAuthorized && item.order.id) {
                        window.open(
                          `/api/portal/sales-orders/${encodeURIComponent(item.order.id)}/meli-nfe?format=danfe`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    },
                    onSendNfe: () => {
                      void sendToBling(item)
                    },
                    onEmitNfce: () => {
                      void emitNfce(item)
                    },
                    onEditCost: item.margin.canEditCost
                      ? () => openCostEditor(item)
                      : undefined,
                    onEditProduct: item.productId
                      ? () => {
                        productEdit.open({
                          id: item.productId as string,
                          name: item.productName,
                          initialEditTab: 'estoque',
                        })
                      }
                      : undefined,
                    onPrintLabel:
                      item.source !== 'service_order'
                      && item.card?.labelPrintable
                      && item.card?.logisticType !== 'fulfillment'
                        ? () => {
                          void openMeliLabelPreview(item)
                        }
                        : undefined,
                    onDownloadLabelZpl:
                      item.source !== 'service_order'
                      && item.card?.labelPrintable
                      && item.card?.logisticType !== 'fulfillment'
                        ? (kind) => {
                          void downloadMeliLabel(item, kind)
                        }
                        : undefined,
                    isPrintingLabel: printingLabelOrderId === item.order.id,
                    menu: (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 shrink-0'
                            aria-label={`Opções de ${orderLabel}`}
                          >
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='min-w-44'>
                          <DropdownMenuItem
                            disabled={!orderHref}
                            onSelect={(event) => {
                              event.preventDefault()
                              if (!orderHref) return
                              router.push(orderHref)
                            }}
                          >
                            <Eye className='mr-2 h-4 w-4' />
                            {item.source === 'service_order' ? 'Ver OS' : 'Ver venda'}
                          </DropdownMenuItem>
                          {item.productId ? (
                            <DropdownMenuItem
                              onSelect={(event) => {
                                event.preventDefault()
                                const productId = item.productId
                                if (!productId) return
                                productEdit.open({
                                  id: productId,
                                  name: item.productName,
                                })
                              }}
                            >
                              <Pencil className='mr-2 h-4 w-4' />
                              Editar produto
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ),
                  }
                })

                const groupKey = group
                  .map((item) => item.id)
                  .join(':')

                return (
                  <SalesOrderListRow
                    key={groupKey}
                    lines={lines}
                    isLast={groupIndex === groups.length - 1}
                  />
                )
              })}
            </TooltipProvider>
          )}
          <VendasListPagination
            page={page}
            pageSize={VENDAS_LIST_PAGE_SIZE}
            total={total}
            disabled={loading}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(labelPreview)}
        onOpenChange={(open) => {
          if (!open) setLabelPreview(null)
        }}
      >
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Etiqueta {labelPreview?.title || ''}</DialogTitle>
            <DialogDescription>
              Prévia da etiqueta ZPL processada (com SKUs). Use Imprimir para enviar à impressora.
            </DialogDescription>
          </DialogHeader>
          <div className='flex max-h-[70vh] justify-center overflow-auto rounded-md border border-border bg-muted/20 p-3'>
            {labelPreview?.pngBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${labelPreview.pngBase64}`}
                alt='Prévia da etiqueta'
                className='h-auto max-w-full'
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setLabelPreview(null)}
            >
              Fechar
            </Button>
            <Button
              type='button'
              onClick={() => {
                if (!labelPreview?.pngBase64) return
                try {
                  printPngBase64(labelPreview.pngBase64)
                } catch {
                  toast({
                    title: 'Falha na impressão',
                    description: 'Não foi possível abrir a impressão da etiqueta.',
                    variant: 'destructive',
                  })
                }
              }}
            >
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SoldItemCostDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={(input) => {
          applyCostUpdate(input)
          setEditItem(null)
        }}
      />

      {productEdit.dialog}
    </>
  )
}
