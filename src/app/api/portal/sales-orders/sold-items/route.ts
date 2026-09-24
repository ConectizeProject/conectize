import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  paymentFeeCentsForSaleEntries,
  paymentFeeDetailsForSaleEntries,
} from '@/lib/resale/resale-commission'
import {
  resolveDisplayCostCentsFromHints,
  trackLastEntryCost,
  type LastEntryCostHint,
} from '@/lib/products/list-display-cost'
import { computeSoldItemMargin } from '@/lib/vendas/sold-item-margin'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'
import {
  extractOsSoldProductLines,
  isCatalogServiceKind,
  soldOsItemId,
  type SoldListSource,
} from '@/lib/vendas/sold-os-product-lines'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type ProductJoin = {
  id?: string
  name?: string | null
  sku?: string | null
  image_url?: string | null
  kind?: string | null
  cost_price_cents?: number | null
  cost_price_manual_edited_at?: string | null
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
    mlOrderId: string | null
    mlPackId: string | null
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

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const page = vendasListPage(searchParams.get('page'))
  const { from, to, pageSize } = vendasListRange(page)
  const oversample = Math.min(800, Math.max((to + 1) * 3, pageSize * 8))

  const [
    { data: fiscalProfile },
    saleItemsRes,
    osOrdersRes,
  ] = await Promise.all([
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('margin_tax_percent')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
    auth.supabase
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
          id,
          order_number,
          status,
          created_at,
          total_cents,
          surcharge_cents,
          ml_order_id,
          ml_pack_id,
          customer_name
        ),
        products (
          id,
          name,
          sku,
          image_url,
          kind,
          cost_price_cents,
          cost_price_manual_edited_at
        )
      `,
      )
      .eq('organization_id', auth.organizationId)
      .eq('sales_orders.status', 'paid')
      .or('product_id.is.null,products.kind.is.null,products.kind.eq.product')
      .order('created_at', { ascending: false })
      .limit(oversample),
    auth.supabase
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
      .eq('organization_id', auth.organizationId)
      .eq('status', 'finalizada')
      .order('closed_at', { ascending: false })
      .limit(Math.min(400, oversample)),
  ])

  if (saleItemsRes.error || osOrdersRes.error) {
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
      }).filter(Boolean),
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
      ? auth.supabase
        .from('product_stock_movements')
        .select('product_id, type, unit_value_cents, created_at')
        .eq('organization_id', auth.organizationId)
        .in('product_id', productIds)
        .eq('type', 'entry')
        .gt('unit_value_cents', 0)
      : Promise.resolve({ data: [] as unknown[] }),
    productIds.length > 0
      ? auth.supabase
        .from('products')
        .select('id, name, sku, image_url, kind, cost_price_cents, cost_price_manual_edited_at')
        .eq('organization_id', auth.organizationId)
        .in('id', productIds)
      : Promise.resolve({ data: [] as unknown[] }),
    saleOrderIds.length > 0
      ? auth.supabase
        .from('fiscal_documents')
        .select('sales_order_id')
        .eq('organization_id', auth.organizationId)
        .eq('status', 'authorized')
        .in('model', ['55', '65'])
        .in('sales_order_id', saleOrderIds)
      : Promise.resolve({ data: [] as Array<{ sales_order_id?: string }> }),
    osOrderIds.length > 0
      ? auth.supabase
        .from('fiscal_documents')
        .select('service_order_id')
        .eq('organization_id', auth.organizationId)
        .eq('status', 'authorized')
        .in('model', ['55', '65'])
        .in('service_order_id', osOrderIds)
      : Promise.resolve({ data: [] as Array<{ service_order_id?: string }> }),
    saleOrderIds.length > 0
      ? auth.supabase
        .from('sales_order_payments')
        .select('sales_order_id, payment_method_id, amount_cents, status, metadata')
        .eq('organization_id', auth.organizationId)
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
    const { data: pmRows } = await auth.supabase
      .from('payment_methods')
      .select('id, description, fee_percent, type, credit_installment_fees')
      .eq('organization_id', auth.organizationId)
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
    const createdAt = String((row as { created_at?: string }).created_at || '')
    const orderNumber = order ? Number(order.order_number) || 0 : 0

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
        createdAt: order ? String(order.created_at || '') : '',
        totalCents: orderTotalCents,
        mlOrderId: order?.ml_order_id != null ? String(order.ml_order_id) : null,
        mlPackId: order?.ml_pack_id != null ? String(order.ml_pack_id) : null,
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
        mlOrderId: null,
        mlPackId: null,
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

  unified.sort((a, b) => b.sortAt - a.sortAt || a.id.localeCompare(b.id))

  const total = unified.length
  const pageRows = unified.slice(from, to + 1)

  const mapped = pageRows.map((row) => {
    const margin = computeSoldItemMargin({
      quantity: row.quantity,
      subtotalCents: row.subtotalCents,
      lineUnitCostCents: row.lineUnitCostCents,
      productCostCents: row.productCostCents,
      hasProduct: row.hasProduct,
      allocatedShippingCents: row.allocatedShippingCents,
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
        mlOrderId: row.order.mlOrderId,
        mlPackId: row.order.mlPackId,
        customerName: row.order.customerName,
        href: row.order.href,
        label: row.order.label,
      },
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
