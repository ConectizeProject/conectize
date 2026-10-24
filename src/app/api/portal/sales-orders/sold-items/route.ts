import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { brazilDayRangeUtc } from '@/lib/dashboard/brazil-day'
import {
  paymentFeeCentsForSaleEntries,
  paymentFeeDetailsForSaleEntries,
} from '@/lib/resale/resale-commission'
import {
  resolveDisplayCostCentsFromHints,
  trackLastEntryCost,
  type LastEntryCostHint,
} from '@/lib/products/list-display-cost'
import {
  allocateSharedShippingToRows,
  computeSoldItemMargin,
} from '@/lib/vendas/sold-item-margin'
import { withLiveMeliFulfillment } from '@/lib/integrations/mercado-livre/fulfillment'
import { withLiveMeliInvoices } from '@/lib/integrations/mercado-livre/api'
import { matchMeliSaleItem, meliItemPublicUrl, taxCentsFromMargin } from '@/lib/vendas/meli-sale-display'
import {
  loadSalesOrderListPresentation,
  loadServiceOrderSoldStockPresentation,
} from '@/lib/vendas/sales-order-list-details'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'
import {
  fulfillmentStagesForLane,
  laneExcludesMeliFull,
  MELI_LABEL_PRINTABLE_SUBSTATUSES,
  orderMatchesSalesLane,
  parseMarketplaceOrderNumber,
  parseSalesLane,
} from '@/lib/vendas/sales-lane'
import {
  extractOsSoldProductLines,
  isCatalogServiceKind,
  soldOsItemId,
  type SoldListSource,
} from '@/lib/vendas/sold-os-product-lines'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { keepSoldItemPacksTogether } from '@/lib/vendas/group-sold-items-by-cart'
import {
  mapSalesOrdersWithFinancePosted,
  mapServiceOrdersWithFinancePosted,
} from '@/lib/finance/service-order-financial-sync'
import { mapServiceOrdersWithStockPosted } from '@/lib/orders/stock-by-status'
import { mapSalesOrdersWithStockPosted } from '@/lib/sales-orders/service'

type ProductJoin = {
  id?: string
  name?: string | null
  sku?: string | null
  image_url?: string | null
  kind?: string | null
  cost_price_cents?: number | null
  cost_price_manual_edited_at?: string | null
  ml_item_id?: string | null
} | null

type PaymentMethodRow = {
  id: string
  description: string
  fee_percent: number
  type: string
  credit_installment_fees?: Array<{ installments: number, fee_percent: number }> | null
}

type UnifiedSoldRow = {
  id: string
  source: SoldListSource
  productId: string | null
  productName: string
  productSku: string | null
  productImageUrl: string | null
  mlItemId: string | null
  quantity: number
  unitPriceCents: number
  lineUnitCostCents: number
  productCostCents: number | null
  subtotalCents: number
  createdAt: string
  sortAt: number
  order: {
    id: string
    orderNumber: number
    createdAt: string
    totalCents: number
    status: string
    mlOrderId: string | null
    mlPackId: string | null
    mlClaimStatus: string | null
    customerName: string | null
    href: string | null
    label: string
  }
  allocatedShippingCents: number
  allocatedFeeCents: number
  feeDetails: Array<{ label: string, amountCents: number }>
  hasAuthorizedFiscalDoc: boolean
  hasProduct: boolean
}

function unwrapProduct (raw: unknown): ProductJoin {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? (first as ProductJoin) : null
  }
  if (typeof raw === 'object') return raw as ProductJoin
  return null
}

function paymentInstallments (metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 1
  const n = Number((metadata as { installments?: unknown }).installments)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1
}

function allocateProportion (
  totalCents: number,
  itemSubtotalCents: number,
  orderTotalCents: number,
): number {
  const total = Math.max(0, Math.trunc(totalCents) || 0)
  if (total <= 0) return 0
  const sub = Math.max(0, Math.trunc(itemSubtotalCents) || 0)
  const orderTotal = Math.max(0, Math.trunc(orderTotalCents) || 0)
  if (orderTotal <= 0) return 0
  return Math.floor((total * sub) / orderTotal)
}

function serializeMargin (margin: ReturnType<typeof computeSoldItemMargin>) {
  return {
    revenueCents: margin.revenueCents,
    shippingCents: margin.shippingCents,
    feeCents: margin.feeCents,
    feeDetails: margin.feeDetails,
    effectiveUnitCostCents: margin.effectiveUnitCostCents,
    costTotalCents: margin.costTotalCents,
    grossProfitCents: margin.grossProfitCents,
    taxCents: margin.taxCents,
    contributionMarginCents: margin.contributionMarginCents,
    contributionMarginPercent: margin.contributionMarginPercent,
    canEditCost: margin.canEditCost,
  }
}

function soldItemCard (
  row: UnifiedSoldRow,
  input: {
    live?: {
      ml_buyer_name?: string | null
      ml_buyer_nickname?: string | null
      ml_logistic_type?: string | null
      ml_shipping_gross_cents?: number | null
      ml_shipping_refund_cents?: number | null
      ml_sale_fee_cents?: number | null
      ml_posting_deadline?: string | null
      ml_delivery_estimate?: string | null
      ml_shipping_method?: string | null
    ml_label_status?: string | null
    ml_label_available_at?: string | null
    ml_label_printable?: boolean | null
    ml_claim_status?: string | null
    ml_shipment_id?: string | null
    ml_sale_items?: Array<{
      itemId: string
      sku: string | null
      title: string | null
      url: string | null
    }> | null
  }
    presented: {
      costTotalCents: number
      stockCurrent: number | null
      stockAfterSale: number | null
    } | null
    marginTaxPercent: number
    nfe: { id: string, status: string } | null
    nfce: { id: string, status: string } | null
    hasFinancePosted: boolean
    hasStockPosted: boolean
    meliInvoice?: { id: string, status: string | null, authorized: boolean } | null
    costTotalCents: number
    /** Frete já rateado no pack/pedido (evita repetir o valor cheio em cada produto). */
    sharedShipping?: {
      shippingGrossCents: number
      shippingRefundCents: number
    } | null
  },
) {
  const live = input.live
  const shippingGrossCents = input.sharedShipping?.shippingGrossCents
    ?? (
      allocateProportion(
        Number(live?.ml_shipping_gross_cents) || 0,
        row.subtotalCents,
        row.order.totalCents,
      ) || row.allocatedShippingCents
    )
  const shippingRefundCents = input.sharedShipping?.shippingRefundCents
    ?? allocateProportion(
      Number(live?.ml_shipping_refund_cents) || 0,
      row.subtotalCents,
      row.order.totalCents,
    )
  const mlFee = Number(live?.ml_sale_fee_cents) || 0
  const saleFeeCents = mlFee > 0
    ? allocateProportion(mlFee, row.subtotalCents, row.order.totalCents)
    : row.allocatedFeeCents
  const isSale = row.source === 'sale'
  const listing = matchMeliSaleItem(live?.ml_sale_items, {
    sku: row.productSku,
    title: row.productName,
  })
  const mlItemId = listing?.itemId || row.mlItemId || null
  const logisticType = live?.ml_logistic_type || null
  const isFull = String(logisticType || '').trim().toLowerCase() === 'fulfillment'
  const orderStatus = isSale ? String(row.order.status || 'paid') : 'paid'
  const isCanceled = orderStatus === 'canceled' || orderStatus === 'cancelled'
  return {
    status: isSale ? orderStatus : 'paid',
    statusLabel: isSale
      ? (isCanceled ? 'Pagamento Devolvido' : null)
      : 'Finalizada',
    allowNfe: !isCanceled,
    buyerName: live?.ml_buyer_name || row.order.customerName,
    buyerNickname: live?.ml_buyer_nickname || null,
    logisticType,
    shippingGrossCents,
    shippingRefundCents,
    saleFeeCents,
    postingDeadline: live?.ml_posting_deadline || null,
    deliveryEstimate: live?.ml_delivery_estimate || null,
    shippingMethod: live?.ml_shipping_method || null,
    labelStatus: live?.ml_label_status || null,
    labelAvailableAt: live?.ml_label_available_at || null,
    labelPrintable: live?.ml_label_printable === true,
    claimStatus: live?.ml_claim_status || row.order.mlClaimStatus || null,
    taxCents: isCanceled
      ? 0
      : taxCentsFromMargin(row.subtotalCents, input.marginTaxPercent),
    costTotalCents: isCanceled
      ? 0
      : (input.presented?.costTotalCents ?? input.costTotalCents),
    // FULL: estoque é do ML, não exibir saldo local.
    stockCurrent: isFull || isCanceled ? null : (input.presented?.stockCurrent ?? null),
    stockAfterSale: isFull || isCanceled ? null : (input.presented?.stockAfterSale ?? null),
    nfeStatus: input.nfe?.status
      ?? (input.meliInvoice?.authorized ? 'authorized' : input.meliInvoice?.status ?? null),
    nfeDocumentId: input.nfe?.id ?? null,
    nfceStatus: input.nfce?.status ?? null,
    nfceDocumentId: input.nfce?.id ?? null,
    hasFinancePosted: input.hasFinancePosted,
    hasStockPosted: input.hasStockPosted,
    meliNfeAuthorized: input.meliInvoice?.authorized === true,
    meliNfeId: input.meliInvoice?.id ?? null,
    mlItemId,
    mlItemUrl: listing?.url || (mlItemId ? meliItemPublicUrl(mlItemId) : null),
    shipmentId: live?.ml_shipment_id || null,
  }
}

function customerDisplayName (customer: unknown): string | null {
  if (!customer || typeof customer !== 'object') return null
  const row = customer as {
    full_name?: string | null
    company_name?: string | null
    trade_name?: string | null
    is_company?: boolean | null
  }
  if (row.is_company) {
    const name = String(row.company_name || row.trade_name || row.full_name || '').trim()
    return name || null
  }
  const name = String(row.full_name || row.company_name || '').trim()
  return name || null
}

function sortMs (iso: string) {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

function missingFulfillmentColumn (message: string | undefined) {
  const text = String(message || '')
  return text.includes('ml_fulfillment_stage')
    || text.includes('ml_logistic_type')
    || text.includes('ml_shipment_status')
    || text.includes('ml_shipment_substatus')
    || text.includes('ml_shipment_id')
    || text.includes('ml_label_status')
    || text.includes('ml_claim_status')
}

function missingClaimStatusColumn (message: string | undefined) {
  return String(message || '').includes('ml_claim_status')
}

export const maxDuration = 60

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { supabase, organizationId } = auth

  const { searchParams } = new URL(request.url)
  const page = vendasListPage(searchParams.get('page'))
  const { from, to, pageSize } = vendasListRange(page)
  const oversample = Math.min(800, Math.max((to + 1) * 3, pageSize * 8))
  const dateFrom = String(searchParams.get('from') || '').trim()
  const dateTo = String(searchParams.get('to') || '').trim()
  const lane = parseSalesLane(searchParams.get('lane')) ?? 'all'
  const sellerUserId = parseOptionalUuid(searchParams.get('seller_user_id'))
  const paymentMethodId = parseOptionalUuid(searchParams.get('payment_method_id'))
  const mlOrder = parseMarketplaceOrderNumber(searchParams.get('ml_order'))
  const laneNeedsFulfillment = lane === 'flex'
    || lane === 'preparing'
    || lane === 'shipped'
    || lane === 'pending_shipment'
  const includeServiceOrders = lane === 'all' && !sellerUserId && !paymentMethodId && !mlOrder

  let paymentOrderIds: string[] | null = null
  if (paymentMethodId) {
    const { data: payRows, error: payError } = await supabase
      .from('sales_order_payments')
      .select('sales_order_id')
      .eq('organization_id', organizationId)
      .eq('payment_method_id', paymentMethodId)
      .neq('status', 'canceled')
      .limit(8000)
    if (payError) {
      console.error('[sold-items]', payError.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    paymentOrderIds = [...new Set((payRows ?? []).map((row) => String(row.sales_order_id || '')).filter(Boolean))]
    if (paymentOrderIds.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0, page, pageSize })
    }
  }

  function buildSaleItemsQuery (
    restrictOrderIds: string[] | null,
    options?: { includeClaimColumns?: boolean },
  ) {
    const includeClaimColumns = options?.includeClaimColumns !== false
    const salesOrderSelect = includeClaimColumns
      ? `
          id,
          order_number,
          status,
          created_at,
          total_cents,
          surcharge_cents,
          ml_order_id,
          ml_pack_id,
          ml_claim_status,
          ml_fulfillment_stage,
          ml_shipment_id,
          customer_name
        `
      : `
          id,
          order_number,
          status,
          created_at,
          total_cents,
          surcharge_cents,
          ml_order_id,
          ml_pack_id,
          ml_fulfillment_stage,
          ml_shipment_id,
          customer_name
        `
    let query = supabase
      .from('sales_order_items')
      .select(
        `
        id,
        product_id,
        quantity,
        unit_price_cents,
        unit_cost_cents,
        discount_cents,
        subtotal_cents,
        created_at,
        sales_orders!inner (
          ${salesOrderSelect}
        ),
        products (
          id,
          name,
          sku,
          image_url,
          kind,
          cost_price_cents,
          cost_price_manual_edited_at,
          ml_item_id
        )
      `,
      )
      .eq('organization_id', organizationId)
      // Data da compra do pedido (sales_orders.created_at), não a criação da linha.
      .order('created_at', { ascending: false, referencedTable: 'sales_orders' })
      .limit(oversample)

    if (lane === 'canceled') {
      query = query.eq('sales_orders.status', 'canceled')
    } else if (lane === 'all' || mlOrder) {
      // Canceladas entram em "Todas" e na busca por pedido MELI.
      query = query.in('sales_orders.status', ['paid', 'canceled'])
    } else {
      query = query.eq('sales_orders.status', 'paid')
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      query = query.gte('sales_orders.created_at', brazilDayRangeUtc(dateFrom).startIso)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      query = query.lte('sales_orders.created_at', brazilDayRangeUtc(dateTo).endIso)
    }
    if (sellerUserId) query = query.eq('sales_orders.seller_user_id', sellerUserId)
    if (mlOrder) {
      query = query.or(
        `ml_order_id.eq.${mlOrder},ml_pack_id.eq.${mlOrder}`,
        { referencedTable: 'sales_orders' },
      )
    }
    if (paymentOrderIds) query = query.in('sales_order_id', paymentOrderIds)
    if (restrictOrderIds) return query.in('sales_order_id', restrictOrderIds)
    // Busca por número do MELI: não restringe por etapa/logística.
    if (mlOrder) return query
    if (lane === 'flex') {
      query = query.not('sales_orders.ml_order_id', 'is', null).eq('sales_orders.ml_logistic_type', 'self_service')
    } else if (lane === 'preparing' || lane === 'shipped' || lane === 'pending_shipment') {
      const stages = fulfillmentStagesForLane(lane) ?? [lane]
      query = query
        .not('sales_orders.ml_order_id', 'is', null)
        .in('sales_orders.ml_fulfillment_stage', stages)
      if (lane === 'preparing') {
        query = query.in(
          'sales_orders.ml_shipment_substatus',
          [...MELI_LABEL_PRINTABLE_SUBSTATUSES],
        )
      }
      if (laneExcludesMeliFull(lane)) {
        // Mantém null/outros tipos; só tira FULL (logística do ML).
        query = query.or(
          'ml_logistic_type.is.null,ml_logistic_type.neq.fulfillment',
          { referencedTable: 'sales_orders' },
        )
      }
    }
    return query
  }

  function buildMarketplaceOrdersQuery (selectColumns: string) {
    let next = supabase
      .from('sales_orders')
      .select(selectColumns)
      .eq('organization_id', organizationId)
      .not('ml_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(mlOrder ? 20 : 60)

    if (lane === 'canceled') {
      next = next.eq('status', 'canceled')
    } else if (lane === 'all' || mlOrder) {
      next = next.in('status', ['paid', 'canceled'])
    } else {
      next = next.eq('status', 'paid')
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      next = next.gte('created_at', brazilDayRangeUtc(dateFrom).startIso)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      next = next.lte('created_at', brazilDayRangeUtc(dateTo).endIso)
    }
    if (sellerUserId) next = next.eq('seller_user_id', sellerUserId)
    if (paymentOrderIds) next = next.in('id', paymentOrderIds)
    if (mlOrder) next = next.or(`ml_order_id.eq.${mlOrder},ml_pack_id.eq.${mlOrder}`)
    return next
  }

  async function marketplaceOrderIdsForLane () {
    const withClaim = 'id, ml_order_id, status, ml_fulfillment_stage, ml_shipment_id, ml_claim_status'
    const withoutClaim = 'id, ml_order_id, status, ml_fulfillment_stage, ml_shipment_id'
    let listed = await buildMarketplaceOrdersQuery(withClaim)
    if (listed.error && missingClaimStatusColumn(listed.error.message)) {
      listed = await buildMarketplaceOrdersQuery(withoutClaim)
    }
    if (listed.error) return { error: listed.error.message, ids: [] as string[] }
    const orders = await withLiveMeliFulfillment({
      supabase: supabase,
      organizationId: organizationId,
      orders: (listed.data ?? []).map((row) => {
        const record = row as unknown as Record<string, unknown>
        const claimRaw = String(record.ml_claim_status || '').trim().toLowerCase()
        return {
          id: String(record.id || ''),
          ml_order_id: record.ml_order_id != null ? String(record.ml_order_id) : null,
          status: record.status != null ? String(record.status) : null,
          ml_claim_status: claimRaw === 'opened' || claimRaw === 'closed' ? claimRaw : null,
          ml_fulfillment_stage: record.ml_fulfillment_stage != null
            ? String(record.ml_fulfillment_stage)
            : null,
          ml_shipment_id: record.ml_shipment_id != null
            ? String(record.ml_shipment_id)
            : null,
        }
      }),
    })
    return {
      error: null,
      ids: orders
        .filter((order) => orderMatchesSalesLane(order, lane))
        .map((order) => order.id),
    }
  }

  let osQuery = supabase
    .from('service_orders')
    .select(
      `
        id,
        display_number,
        status,
        services,
        services_total_cents,
        payment_methods,
        closed_at,
        updated_at,
        created_at,
        customers (
          full_name,
          company_name,
          trade_name,
          is_company
        )
      `,
    )
    .eq('organization_id', organizationId)
    .eq('status', 'finalizada')
    .order('closed_at', { ascending: false })
    .limit(Math.min(400, oversample))

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    osQuery = osQuery.gte('closed_at', brazilDayRangeUtc(dateFrom).startIso)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    osQuery = osQuery.lte('closed_at', brazilDayRangeUtc(dateTo).endIso)
  }

  const [
    { data: fiscalProfile },
    saleItemsFirst,
    osOrdersRes,
  ] = await Promise.all([
    supabase
      .from('organization_fiscal_profiles')
      .select('margin_tax_percent')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    buildSaleItemsQuery(null),
    includeServiceOrders
      ? osQuery
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])

  let saleItemsRes = saleItemsFirst
  if (saleItemsRes.error && missingClaimStatusColumn(saleItemsRes.error.message)) {
    saleItemsRes = await buildSaleItemsQuery(null, { includeClaimColumns: false })
  }
  if (
    saleItemsRes.error
    && laneNeedsFulfillment
    && missingFulfillmentColumn(saleItemsRes.error.message)
  ) {
    const matched = await marketplaceOrderIdsForLane()
    if (matched.error) {
      console.error('[sold-items]', matched.error)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    if (matched.ids.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0, page, pageSize })
    }
    saleItemsRes = await buildSaleItemsQuery(matched.ids, { includeClaimColumns: false })
  }

  if (saleItemsRes.error || osOrdersRes.error) {
    console.error(
      '[sold-items]',
      saleItemsRes.error?.message || null,
      osOrdersRes.error?.message || null,
    )
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const marginTaxPercent = Number(
    (fiscalProfile as { margin_tax_percent?: number | null } | null)?.margin_tax_percent,
  ) || 0

  const saleRows = (saleItemsRes.data ?? []).filter((row) => {
    const product = unwrapProduct((row as { products?: unknown }).products)
    if (!product?.id) return true
    return !isCatalogServiceKind(product.kind)
  })

  type OsOrderRow = {
    id: string
    display_number?: number | null
    services?: unknown
    services_total_cents?: number | null
    payment_methods?: unknown
    closed_at?: string | null
    updated_at?: string | null
    created_at?: string | null
    customers?: unknown
  }

  const osOrders = (osOrdersRes.data ?? []) as OsOrderRow[]
  const osProductDrafts: Array<{
    order: OsOrderRow
    line: ReturnType<typeof extractOsSoldProductLines>[number]
    createdAt: string
  }> = []

  for (const order of osOrders) {
    const createdAt =
      String(order.closed_at || order.updated_at || order.created_at || '')
    const lines = extractOsSoldProductLines(order.services)
    for (const line of lines) {
      osProductDrafts.push({ order, line, createdAt })
    }
  }

  const saleOrderIds = [
    ...new Set(
      saleRows.map((row) => {
        const orderRaw = (row as { sales_orders?: unknown }).sales_orders
        const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
        return order && typeof order === 'object'
          ? String((order as { id?: unknown }).id || '')
          : ''
      }).filter((id): id is string => Boolean(id)),
    ),
  ]
  const osOrderIds = [...new Set(osOrders.map((o) => String(o.id || '')).filter(Boolean))]

  const productIds = [
    ...new Set([
      ...saleRows.map((row) => {
        const product = unwrapProduct((row as { products?: unknown }).products)
        return product?.id ? String(product.id) : ''
      }),
      ...osProductDrafts.map((d) => d.line.productId),
    ].filter(Boolean)),
  ]

  const lastEntryByProductId = new Map<string, LastEntryCostHint>()
  const productById = new Map<string, ProductJoin>()
  const feeBySaleOrderId = new Map<string, number>()
  const feeDetailsBySaleOrderId = new Map<string, Array<{ label: string, amountCents: number }>>()
  const feeByOsOrderId = new Map<string, number>()
  const feeDetailsByOsOrderId = new Map<string, Array<{ label: string, amountCents: number }>>()
  const hasFiscalSaleOrderIds = new Set<string>()
  const hasFiscalOsOrderIds = new Set<string>()

  const [
    lastEntriesRes,
    productsRes,
    saleFiscalRes,
    osFiscalRes,
    salePaymentsRes,
  ] = await Promise.all([
    productIds.length > 0
      ? supabase
        .from('product_stock_movements')
        .select('product_id, type, unit_value_cents, created_at')
        .eq('organization_id', organizationId)
        .in('product_id', productIds)
        .eq('type', 'entry')
        .gt('unit_value_cents', 0)
      : Promise.resolve({ data: [] as unknown[] }),
    productIds.length > 0
      ? supabase
        .from('products')
        .select('id, name, sku, image_url, kind, cost_price_cents, cost_price_manual_edited_at, ml_item_id')
        .eq('organization_id', organizationId)
        .in('id', productIds)
      : Promise.resolve({ data: [] as unknown[] }),
    saleOrderIds.length > 0
      ? supabase
        .from('fiscal_documents')
        .select('sales_order_id')
        .eq('organization_id', organizationId)
        .eq('status', 'authorized')
        .in('model', ['55', '65'])
        .in('sales_order_id', saleOrderIds)
      : Promise.resolve({ data: [] as Array<{ sales_order_id?: string }> }),
    osOrderIds.length > 0
      ? supabase
        .from('fiscal_documents')
        .select('service_order_id')
        .eq('organization_id', organizationId)
        .eq('status', 'authorized')
        .in('model', ['55', '65'])
        .in('service_order_id', osOrderIds)
      : Promise.resolve({ data: [] as Array<{ service_order_id?: string }> }),
    saleOrderIds.length > 0
      ? supabase
        .from('sales_order_payments')
        .select('sales_order_id, payment_method_id, amount_cents, status, metadata')
        .eq('organization_id', organizationId)
        .in('sales_order_id', saleOrderIds)
        .neq('status', 'canceled')
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  for (const row of lastEntriesRes.data ?? []) {
    trackLastEntryCost(
      lastEntryByProductId,
      String((row as { product_id?: string }).product_id || ''),
      String((row as { type?: string }).type || 'entry'),
      Number((row as { unit_value_cents?: number }).unit_value_cents) || 0,
      (row as { created_at?: string | null }).created_at,
    )
  }

  for (const row of productsRes.data ?? []) {
    const id = String((row as { id?: string }).id || '')
    if (!id) continue
    productById.set(id, row as ProductJoin)
  }

  for (const doc of saleFiscalRes.data ?? []) {
    const oid = String((doc as { sales_order_id?: string }).sales_order_id || '')
    if (oid) hasFiscalSaleOrderIds.add(oid)
  }
  for (const doc of osFiscalRes.data ?? []) {
    const oid = String((doc as { service_order_id?: string }).service_order_id || '')
    if (oid) hasFiscalOsOrderIds.add(oid)
  }

  const osPaymentEntries: Array<{
    orderId: string
    payment_method_id: string
    value_cents: number
    installments: number
  }> = []
  for (const order of osOrders) {
    const oid = String(order.id || '')
    if (!oid) continue
    const raw = order.payment_methods
    const arr = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? (() => {
          try {
            const p = JSON.parse(raw)
            return Array.isArray(p) ? p : []
          } catch {
            return []
          }
        })()
        : []
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue
      const pmId = parseOptionalUuid((entry as { payment_method_id?: unknown }).payment_method_id)
      if (!pmId) continue
      osPaymentEntries.push({
        orderId: oid,
        payment_method_id: pmId,
        value_cents: Math.max(0, Number((entry as { value_cents?: unknown }).value_cents) || 0),
        installments: Math.max(
          1,
          Math.min(24, Number((entry as { installments?: unknown }).installments) || 1),
        ),
      })
    }
  }

  const salePaymentsByOrderId = new Map<
    string,
    Array<{ payment_method_id: string, value_cents: number | null, installments: number }>
  >()
  for (const pay of salePaymentsRes.data ?? []) {
    const oid = String((pay as { sales_order_id?: string }).sales_order_id || '')
    const pmId = String((pay as { payment_method_id?: string | null }).payment_method_id || '')
    if (!oid || !pmId) continue
    const list = salePaymentsByOrderId.get(oid) ?? []
    list.push({
      payment_method_id: pmId,
      value_cents: Math.max(0, Number((pay as { amount_cents?: number }).amount_cents) || 0),
      installments: paymentInstallments((pay as { metadata?: unknown }).metadata),
    })
    salePaymentsByOrderId.set(oid, list)
  }

  const pmIds = [
    ...new Set([
      ...[...salePaymentsByOrderId.values()].flatMap((list) => list.map((e) => e.payment_method_id)),
      ...osPaymentEntries.map((e) => e.payment_method_id),
    ]),
  ]

  let paymentMethods: PaymentMethodRow[] = []
  if (pmIds.length > 0) {
    const { data: pmRows } = await supabase
      .from('payment_methods')
      .select('id, description, fee_percent, type, credit_installment_fees')
      .eq('organization_id', organizationId)
      .in('id', pmIds)
    paymentMethods = (pmRows ?? []).map((row) => ({
      id: String(row.id),
      description: String(row.description || ''),
      fee_percent: Number(row.fee_percent) || 0,
      type: String(row.type || ''),
      credit_installment_fees: Array.isArray(row.credit_installment_fees)
        ? row.credit_installment_fees
        : null,
    }))
  }

  for (const oid of saleOrderIds) {
    const entries = salePaymentsByOrderId.get(oid) ?? []
    feeBySaleOrderId.set(oid, paymentFeeCentsForSaleEntries(entries, paymentMethods))
    feeDetailsBySaleOrderId.set(
      oid,
      paymentFeeDetailsForSaleEntries(entries, paymentMethods),
    )
  }

  const osEntriesByOrder = new Map<string, typeof osPaymentEntries>()
  for (const entry of osPaymentEntries) {
    const list = osEntriesByOrder.get(entry.orderId) ?? []
    list.push(entry)
    osEntriesByOrder.set(entry.orderId, list)
  }
  for (const oid of osOrderIds) {
    const entries = (osEntriesByOrder.get(oid) ?? []).map((e) => ({
      payment_method_id: e.payment_method_id,
      value_cents: e.value_cents,
      installments: e.installments,
    }))
    feeByOsOrderId.set(oid, paymentFeeCentsForSaleEntries(entries, paymentMethods))
    feeDetailsByOsOrderId.set(
      oid,
      paymentFeeDetailsForSaleEntries(entries, paymentMethods),
    )
  }

  function resolveProductCost (product: ProductJoin, productId: string | null) {
    if (!productId) return null
    const catalog = product ?? productById.get(productId) ?? null
    const resolved = resolveDisplayCostCentsFromHints({
      costPriceCents: catalog?.cost_price_cents,
      costPriceManualEditedAt: catalog?.cost_price_manual_edited_at,
      lastEntry: lastEntryByProductId.get(productId),
    })
    return resolved != null ? Math.max(0, resolved) : null
  }

  const unified: UnifiedSoldRow[] = []
  const saleOrderLiveSeedById = new Map<string, {
    ml_claim_status: string | null
    ml_fulfillment_stage: string | null
    ml_shipment_id: string | null
  }>()

  for (const row of saleRows) {
    const orderRaw = (row as { sales_orders?: unknown }).sales_orders
    const order = (Array.isArray(orderRaw) ? orderRaw[0] : orderRaw) as Record<
      string,
      unknown
    > | null
    const product = unwrapProduct((row as { products?: unknown }).products)
    const hasProduct = Boolean(product?.id)
    const orderId = order ? String(order.id || '') : ''
    const quantity = Math.max(1, Number((row as { quantity?: number }).quantity) || 1)
    const subtotalCents = Math.max(
      0,
      Number((row as { subtotal_cents?: number }).subtotal_cents) || 0,
    )
    const orderTotalCents = order ? Math.max(0, Number(order.total_cents) || 0) : 0
    const orderShippingCents = order ? Math.max(0, Number(order.surcharge_cents) || 0) : 0
    const lineUnitCostCents = Math.max(
      0,
      Number((row as { unit_cost_cents?: number }).unit_cost_cents) || 0,
    )
    const productId = hasProduct ? String(product!.id) : null
    const productCostCents = resolveProductCost(product, productId)
    const orderFeeCents = feeBySaleOrderId.get(orderId) ?? 0
    const allocatedFeeCents = allocateProportion(orderFeeCents, subtotalCents, orderTotalCents)
    const allocatedShippingCents = allocateProportion(
      orderShippingCents,
      subtotalCents,
      orderTotalCents,
    )
    const orderFeeDetails = feeDetailsBySaleOrderId.get(orderId) ?? []
    const feeDetails =
      orderFeeCents > 0 && allocatedFeeCents > 0
        ? orderFeeDetails.map((d) => ({
          label: d.label,
          amountCents: allocateProportion(d.amountCents, subtotalCents, orderTotalCents),
        })).filter((d) => d.amountCents > 0)
        : []
    const orderCreatedAt = order ? String(order.created_at || '') : ''
    const createdAt = orderCreatedAt || String((row as { created_at?: string }).created_at || '')
    const orderNumber = order ? Number(order.order_number) || 0 : 0
    const claimRaw = String(order?.ml_claim_status || '').trim().toLowerCase()
    const mlClaimStatus = claimRaw === 'opened' || claimRaw === 'closed' ? claimRaw : null
    if (orderId && !saleOrderLiveSeedById.has(orderId)) {
      saleOrderLiveSeedById.set(orderId, {
        ml_claim_status: mlClaimStatus,
        ml_fulfillment_stage: order?.ml_fulfillment_stage != null
          ? String(order.ml_fulfillment_stage)
          : null,
        ml_shipment_id: order?.ml_shipment_id != null
          ? String(order.ml_shipment_id)
          : null,
      })
    }

    unified.push({
      id: String((row as { id?: string }).id || ''),
      source: 'sale',
      productId,
      productName: hasProduct
        ? String(product?.name || '').trim() || 'Produto'
        : 'Produto não vinculado',
      productSku: hasProduct && product?.sku ? String(product.sku) : null,
      productImageUrl:
        hasProduct && product?.image_url && String(product.image_url).trim()
          ? String(product.image_url).trim()
          : null,
      mlItemId: hasProduct && product?.ml_item_id ? String(product.ml_item_id).trim() : null,
      quantity,
      unitPriceCents: Math.max(
        0,
        Number((row as { unit_price_cents?: number }).unit_price_cents) || 0,
      ),
      lineUnitCostCents,
      productCostCents,
      subtotalCents,
      createdAt,
      sortAt: sortMs(createdAt),
      order: {
        id: orderId,
        orderNumber,
        createdAt: orderCreatedAt,
        totalCents: orderTotalCents,
        status: order ? String(order.status || 'paid') : 'paid',
        mlOrderId: order?.ml_order_id != null ? String(order.ml_order_id) : null,
        mlPackId: order?.ml_pack_id != null ? String(order.ml_pack_id) : null,
        mlClaimStatus,
        customerName:
          order?.customer_name != null && String(order.customer_name).trim()
            ? String(order.customer_name).trim()
            : null,
        href: orderId ? `/portal/vendas/${encodeURIComponent(orderId)}` : null,
        label: `Pedido #${orderNumber}`,
      },
      allocatedShippingCents,
      allocatedFeeCents,
      feeDetails,
      hasAuthorizedFiscalDoc: hasFiscalSaleOrderIds.has(orderId),
      hasProduct,
    })
  }

  for (const draft of osProductDrafts) {
    const { order, line, createdAt } = draft
    const orderId = String(order.id || '')
    const catalog = productById.get(line.productId) ?? null
    if (catalog && isCatalogServiceKind(catalog.kind)) continue

    const hasProduct = Boolean(line.productId)
    const productCostCents = resolveProductCost(catalog, line.productId)
    const orderTotalCents = Math.max(0, Number(order.services_total_cents) || 0)
    const subtotalCents = Math.max(0, line.valueCents)
    const orderFeeCents = feeByOsOrderId.get(orderId) ?? 0
    const allocatedFeeCents = allocateProportion(orderFeeCents, subtotalCents, orderTotalCents)
    const orderFeeDetails = feeDetailsByOsOrderId.get(orderId) ?? []
    const feeDetails =
      orderFeeCents > 0 && allocatedFeeCents > 0
        ? orderFeeDetails.map((d) => ({
          label: d.label,
          amountCents: allocateProportion(d.amountCents, subtotalCents, orderTotalCents),
        })).filter((d) => d.amountCents > 0)
        : []
    const displayNumber = Number(order.display_number) || 0
    const productName =
      (catalog?.name && String(catalog.name).trim())
      || line.description
      || 'Produto'

    unified.push({
      id: soldOsItemId(orderId, line.lineIndex),
      source: 'service_order',
      productId: line.productId,
      productName,
      productSku: catalog?.sku ? String(catalog.sku) : null,
      productImageUrl:
        catalog?.image_url && String(catalog.image_url).trim()
          ? String(catalog.image_url).trim()
          : null,
      mlItemId: catalog?.ml_item_id ? String(catalog.ml_item_id).trim() : null,
      quantity: line.quantity,
      unitPriceCents: line.unitValueCents,
      lineUnitCostCents: line.unitCostCents,
      productCostCents,
      subtotalCents,
      createdAt,
      sortAt: sortMs(createdAt),
      order: {
        id: orderId,
        orderNumber: displayNumber,
        createdAt,
        totalCents: orderTotalCents,
        status: 'paid',
        mlOrderId: null,
        mlPackId: null,
        mlClaimStatus: null,
        customerName: customerDisplayName(order.customers),
        href: displayNumber > 0
          ? `/portal/ordens/${encodeURIComponent(String(displayNumber))}`
          : null,
        label: `OS #${displayNumber || '—'}`,
      },
      allocatedShippingCents: 0,
      allocatedFeeCents,
      feeDetails,
      hasAuthorizedFiscalDoc: hasFiscalOsOrderIds.has(orderId),
      hasProduct,
    })
  }

  // Mais recentes primeiro: data da compra; em empate, número do pedido.
  unified.sort((a, b) => (
    b.sortAt - a.sortAt
    || b.order.orderNumber - a.order.orderNumber
    || a.id.localeCompare(b.id)
  ))
  const ordered = keepSoldItemPacksTogether(unified)

  const total = ordered.length
  const pageRows = ordered.slice(from, to + 1)
  const saleOrders = [...new Map(
    pageRows
      .filter((row) => row.source === 'sale' && row.order.id)
      .map((row) => {
        const liveSeed = saleOrderLiveSeedById.get(row.order.id)
        return [row.order.id, {
          id: row.order.id,
          ml_order_id: row.order.mlOrderId,
          created_at: row.order.createdAt,
          total_cents: row.order.totalCents,
          status: row.order.status,
          ml_claim_status: liveSeed?.ml_claim_status ?? null,
          ml_fulfillment_stage: liveSeed?.ml_fulfillment_stage ?? null,
          ml_shipment_id: liveSeed?.ml_shipment_id ?? null,
        }]
      }),
  ).values()]
  const saleOrderIdsOnPage = saleOrders.map((order) => order.id)
  const osOrderIdsOnPage = [...new Set(
    pageRows
      .filter((row) => row.source === 'service_order')
      .map((row) => row.order.id)
      .filter(Boolean),
  )]
  let liveOrders = saleOrders
  let presentation = {
    marginTaxPercent: 0,
    itemsByOrderId: new Map() as Awaited<ReturnType<typeof loadSalesOrderListPresentation>>['itemsByOrderId'],
  }
  let fiscalRows: { data: Array<{ id?: string, sales_order_id?: string, status?: string, model?: string }> | null, error: unknown } = { data: [], error: null }
  let osFiscalRows: { data: Array<{ id?: string, service_order_id?: string, status?: string, model?: string }> | null, error: unknown } = { data: [], error: null }
  let financePostedIds = new Set<string>()
  let stockPostedIds = new Set<string>()
  let osFinancePostedIds = new Set<string>()
  let osStockPostedIds = new Set<string>()
  let osStockByKey = new Map<string, { stockCurrent: number | null, stockAfterSale: number | null }>()
  const osStockRows = pageRows
    .filter((row) => row.source === 'service_order' && row.productId)
    .map((row) => ({
      orderId: row.order.id,
      productId: row.productId as string,
      createdAt: row.createdAt,
    }))
  try {
    const enriched = await Promise.all([
      withLiveMeliFulfillment({
        supabase: supabase,
        organizationId: organizationId,
        orders: saleOrders,
      }),
      loadSalesOrderListPresentation({
        supabase: supabase,
        organizationId: organizationId,
        orders: saleOrders,
      }),
      saleOrderIdsOnPage.length > 0
        ? supabase
          .from('fiscal_documents')
          .select('id, sales_order_id, status, model')
          .eq('organization_id', organizationId)
          .neq('status', 'canceled')
          .in('sales_order_id', saleOrderIdsOnPage)
        : Promise.resolve({ data: [], error: null }),
      osOrderIdsOnPage.length > 0
        ? supabase
          .from('fiscal_documents')
          .select('id, service_order_id, status, model')
          .eq('organization_id', organizationId)
          .neq('status', 'canceled')
          .in('service_order_id', osOrderIdsOnPage)
        : Promise.resolve({ data: [], error: null }),
      mapSalesOrdersWithFinancePosted(supabase, organizationId, saleOrderIdsOnPage),
      mapSalesOrdersWithStockPosted(auth, saleOrderIdsOnPage),
      mapServiceOrdersWithFinancePosted(supabase, organizationId, osOrderIdsOnPage),
      mapServiceOrdersWithStockPosted(supabase, organizationId, osOrderIdsOnPage),
      loadServiceOrderSoldStockPresentation({
        supabase,
        organizationId,
        rows: osStockRows,
      }),
    ])
    liveOrders = enriched[0]
    presentation = enriched[1]
    fiscalRows = enriched[2]
    osFiscalRows = enriched[3]
    financePostedIds = enriched[4]
    stockPostedIds = enriched[5]
    osFinancePostedIds = enriched[6]
    osStockPostedIds = enriched[7]
    osStockByKey = enriched[8]
  } catch (err) {
    console.error('[sold-items] enrich page failed', err)
  }
  const liveByOrderId = new Map(liveOrders.map((order) => [order.id, order]))
  const meliInvoiceByOrderId = await withLiveMeliInvoices({
    supabase: supabase,
    organizationId: organizationId,
    orders: liveOrders.map((order) => ({
      id: order.id,
      ml_order_id: order.ml_order_id,
      ml_shipment_id: order.ml_shipment_id != null ? String(order.ml_shipment_id) : null,
      ml_logistic_type: order.ml_logistic_type ?? null,
    })),
  })
  const nfeByOrderId = new Map<string, { id: string, status: string }>()
  const nfceByOrderId = new Map<string, { id: string, status: string }>()
  if (!fiscalRows.error) {
    for (const row of fiscalRows.data ?? []) {
      const salesOrderId = String(row.sales_order_id || '')
      if (!salesOrderId) continue
      const mapped = {
        id: String(row.id),
        status: String(row.status || 'pending'),
      }
      if (String(row.model) === '55') nfeByOrderId.set(salesOrderId, mapped)
      else nfceByOrderId.set(salesOrderId, mapped)
    }
  }
  if (!osFiscalRows.error) {
    for (const row of osFiscalRows.data ?? []) {
      const serviceOrderId = String((row as { service_order_id?: string }).service_order_id || '')
      if (!serviceOrderId) continue
      const mapped = {
        id: String(row.id),
        status: String(row.status || 'pending'),
      }
      if (String(row.model) === '55') nfeByOrderId.set(serviceOrderId, mapped)
      else nfceByOrderId.set(serviceOrderId, mapped)
    }
  }

  const shippingByOrderId = new Map<string, {
    shipmentId: string | null
    shippingGrossCents: number
    shippingRefundCents: number
  }>()
  for (const order of liveOrders) {
    shippingByOrderId.set(order.id, {
      shipmentId: order.ml_shipment_id != null ? String(order.ml_shipment_id) : null,
      shippingGrossCents: Number(order.ml_shipping_gross_cents) || 0,
      shippingRefundCents: Number(order.ml_shipping_refund_cents) || 0,
    })
  }
  // Sem live: reconstrói o frete do pedido somando o que já foi alocado nas linhas.
  const fallbackShippingByOrderId = new Map<string, number>()
  for (const row of pageRows) {
    if (row.source !== 'sale' || !row.order.id) continue
    if (shippingByOrderId.has(row.order.id)) continue
    fallbackShippingByOrderId.set(
      row.order.id,
      (fallbackShippingByOrderId.get(row.order.id) || 0) + Math.max(0, row.allocatedShippingCents),
    )
  }
  for (const [orderId, shippingGrossCents] of fallbackShippingByOrderId) {
    if (shippingGrossCents <= 0) continue
    shippingByOrderId.set(orderId, {
      shipmentId: null,
      shippingGrossCents,
      shippingRefundCents: 0,
    })
  }
  const sharedShippingByRowId = allocateSharedShippingToRows(
    pageRows.filter((row) => row.source === 'sale'),
    shippingByOrderId,
  )

  const mapped = pageRows.map((row) => {
    const sharedShipping = sharedShippingByRowId.get(row.id) ?? null
    const allocatedShippingCents = sharedShipping?.shippingGrossCents
      ?? row.allocatedShippingCents
    const margin = computeSoldItemMargin({
      quantity: row.quantity,
      subtotalCents: row.subtotalCents,
      lineUnitCostCents: row.lineUnitCostCents,
      productCostCents: row.productCostCents,
      hasProduct: row.hasProduct,
      allocatedShippingCents,
      allocatedFeeCents: row.allocatedFeeCents,
      feeDetails: row.feeDetails,
      marginTaxPercent,
      hasAuthorizedFiscalDoc: row.hasAuthorizedFiscalDoc,
    })

    return {
      id: row.id,
      source: row.source,
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      productImageUrl: row.productImageUrl,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      lineUnitCostCents: row.lineUnitCostCents,
      productCostCents: row.productCostCents,
      subtotalCents: row.subtotalCents,
      createdAt: row.createdAt,
      order: {
        id: row.order.id,
        orderNumber: row.order.orderNumber,
        createdAt: row.order.createdAt,
        totalCents: row.order.totalCents,
        status: row.order.status,
        mlOrderId: row.order.mlOrderId,
        mlPackId: row.order.mlPackId,
        customerName: row.order.customerName,
        href: row.order.href,
        label: row.order.label,
      },
      card: soldItemCard(row, {
        live: liveByOrderId.get(row.order.id),
        presented: row.source === 'service_order'
          ? (() => {
            const stock = row.productId
              ? osStockByKey.get(`${row.order.id}:${row.productId}`)
              : null
            if (!stock) return null
            return {
              costTotalCents: margin.costTotalCents,
              stockCurrent: stock.stockCurrent,
              stockAfterSale: stock.stockAfterSale,
            }
          })()
          : presentation.itemsByOrderId.get(row.order.id)?.find((item) => (
            item.productId === row.productId
          )) ?? null,
        marginTaxPercent: presentation.marginTaxPercent,
        nfe: nfeByOrderId.get(row.order.id) ?? null,
        nfce: nfceByOrderId.get(row.order.id) ?? null,
        hasFinancePosted: row.source === 'service_order'
          ? osFinancePostedIds.has(row.order.id)
          : financePostedIds.has(row.order.id),
        hasStockPosted: row.source === 'service_order'
          ? osStockPostedIds.has(row.order.id)
          : stockPostedIds.has(row.order.id),
        meliInvoice: meliInvoiceByOrderId.get(row.order.id) ?? null,
        costTotalCents: margin.costTotalCents,
        sharedShipping,
      }),
      margin: serializeMargin(margin),
    }
  })

  return NextResponse.json({
    ok: true,
    items: mapped,
    total,
    page,
    pageSize,
  })
}
