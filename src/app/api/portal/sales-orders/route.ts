import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { brazilDayRangeUtc } from '@/lib/dashboard/brazil-day'
import {
  createSalesOrder,
  mapSalesOrdersWithFinancePosted,
  mapSalesOrdersWithStockPosted,
} from '@/lib/sales-orders/service'
import { getOpenCashSession } from '@/lib/pdv/service'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'
import { withLiveMeliFulfillment } from '@/lib/integrations/mercado-livre/fulfillment'
import {
  fulfillmentStagesForLane,
  laneExcludesMeliFull,
  MELI_LABEL_PRINTABLE_SUBSTATUSES,
  orderMatchesSalesLane,
  parseMarketplaceOrderNumber,
  parseSalesLane,
} from '@/lib/vendas/sales-lane'
import { loadSalesOrderListPresentation, orderTaxCents } from '@/lib/vendas/sales-order-list-details'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ORDER_COLUMNS = 'id, order_number, status, seller_user_id, customer_name, customer_type, customer_document, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, bling_pedido_id, bling_nfce_id, created_at, updated_at, ml_order_id, ml_pack_id'
const FULFILLMENT_COLUMNS = `${ORDER_COLUMNS}, ml_shipment_status, ml_shipment_substatus, ml_logistic_type, ml_fulfillment_stage, ml_shipment_id, ml_claim_status`

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

export const maxDuration = 60

type ListedOrder = {
  id: string
  total_cents?: number | null
  created_at?: string | null
  ml_order_id?: string | null
  ml_logistic_type?: string | null
  ml_fulfillment_stage?: string | null
  ml_shipment_status?: string | null
  ml_shipment_substatus?: string | null
}

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const from = String(searchParams.get('from') || '').trim()
  const to = String(searchParams.get('to') || '').trim()
  const sellerUserId = String(searchParams.get('seller_user_id') || '').trim()
  const status = String(searchParams.get('status') || '').trim()
  const lane = parseSalesLane(searchParams.get('lane'))
  const paymentMethodId = String(searchParams.get('payment_method_id') || '').trim()
  const mlOrder = parseMarketplaceOrderNumber(searchParams.get('ml_order'))
  const currentCash = searchParams.get('current_cash') === '1'
  const pageParam = searchParams.get('page')
  const paginated = pageParam != null
  const page = paginated ? vendasListPage(pageParam) : 1
  const { from: rangeFrom, to: rangeTo, pageSize } = vendasListRange(page)

  function buildOrdersQuery (columns: string) {
    let query = auth.supabase
      .from('sales_orders')
      .select(columns, { count: 'exact' })
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })

    if (paginated) query = query.range(rangeFrom, rangeTo)
    else query = query.limit(200)
    return query
  }

  let paymentOrderIds: string[] | null = null
  if (paymentMethodId) {
    if (!UUID_RE.test(paymentMethodId)) {
      return NextResponse.json({
        ok: true,
        orders: [],
        total: 0,
        page,
        pageSize: paginated ? pageSize : 200,
      })
    }
    const { data: payRows, error: payError } = await auth.supabase
      .from('sales_order_payments')
      .select('sales_order_id')
      .eq('organization_id', auth.organizationId)
      .eq('payment_method_id', paymentMethodId)
      .neq('status', 'canceled')
      .limit(8000)
    if (payError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    const matchingIds = [...new Set((payRows ?? []).map((row) => String(row.sales_order_id)))]
    if (matchingIds.length === 0) {
      return NextResponse.json({
        ok: true,
        orders: [],
        total: 0,
        page,
        pageSize: paginated ? pageSize : 200,
      })
    }
    paymentOrderIds = matchingIds
  }

  let cashSessionId: string | null = null
  if (currentCash) {
    const session = await getOpenCashSession(auth)
    if (!session.ok) {
      return NextResponse.json({
        ok: true,
        orders: [],
        total: 0,
        page,
        pageSize: paginated ? pageSize : 200,
      })
    }
    cashSessionId = session.session.id
  }

  function filteredQuery (columns: string) {
    let next = buildOrdersQuery(columns)

    if (from && DATE_RE.test(from)) {
      next = next.gte('created_at', brazilDayRangeUtc(from).startIso)
    }
    if (to && DATE_RE.test(to)) {
      next = next.lte('created_at', brazilDayRangeUtc(to).endIso)
    }
    if (sellerUserId) next = next.eq('seller_user_id', sellerUserId)
    if (lane === 'canceled') next = next.eq('status', 'canceled')
    else if (lane === 'all' || mlOrder) {
      // Canceladas entram em "Todas" e na busca por pedido MELI.
      next = next.in('status', ['paid', 'canceled'])
    } else if (lane === 'flex') {
      next = next.eq('status', 'paid').not('ml_order_id', 'is', null).eq('ml_logistic_type', 'self_service')
    } else if (lane === 'preparing' || lane === 'shipped' || lane === 'pending_shipment') {
      const stages = fulfillmentStagesForLane(lane) ?? [lane]
      next = next
        .eq('status', 'paid')
        .not('ml_order_id', 'is', null)
        .in('ml_fulfillment_stage', stages)
      if (lane === 'preparing') {
        next = next.in('ml_shipment_substatus', [...MELI_LABEL_PRINTABLE_SUBSTATUSES])
      }
      if (laneExcludesMeliFull(lane)) {
        // Mantém null/outros tipos; só tira FULL (logística do ML).
        next = next.or('ml_logistic_type.is.null,ml_logistic_type.neq.fulfillment')
      }
    } else if (status) next = next.eq('status', status)
    if (paymentOrderIds) next = next.in('id', paymentOrderIds)
    if (cashSessionId) next = next.eq('cash_session_id', cashSessionId)
    if (mlOrder) {
      next = next.or(`ml_order_id.eq.${mlOrder},ml_pack_id.eq.${mlOrder}`)
      // Busca por número: não restringe por etapa/logística além do status acima.
      return next
    }

    return next
  }

  function recentMarketplaceQuery () {
    let next = auth.supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS)
      .eq('organization_id', auth.organizationId)
      .eq('status', 'paid')
      .not('ml_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(mlOrder ? 20 : 60)

    if (from && DATE_RE.test(from)) {
      next = next.gte('created_at', brazilDayRangeUtc(from).startIso)
    }
    if (to && DATE_RE.test(to)) {
      next = next.lte('created_at', brazilDayRangeUtc(to).endIso)
    }
    if (sellerUserId) next = next.eq('seller_user_id', sellerUserId)
    if (paymentOrderIds) next = next.in('id', paymentOrderIds)
    if (cashSessionId) next = next.eq('cash_session_id', cashSessionId)
    if (mlOrder) next = next.or(`ml_order_id.eq.${mlOrder},ml_pack_id.eq.${mlOrder}`)
    return next
  }

  const laneNeedsFulfillment = lane === 'flex'
    || lane === 'preparing'
    || lane === 'shipped'
    || lane === 'pending_shipment'

  let classifyLaneInMemory = false
  let listed = await filteredQuery(FULFILLMENT_COLUMNS)
  if (listed.error && missingFulfillmentColumn(listed.error.message)) {
    classifyLaneInMemory = laneNeedsFulfillment
    listed = laneNeedsFulfillment
      ? await recentMarketplaceQuery()
      : await filteredQuery(ORDER_COLUMNS)
  }
  if (listed.error) {
    console.error('[sales-orders]', listed.error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  const { data, count } = listed

  let orders = (data ?? []) as ListedOrder[]
  let total = count ?? orders.length
  orders = await withLiveMeliFulfillment({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    orders,
  })
  if (classifyLaneInMemory) {
    const matched = orders.filter((order) => orderMatchesSalesLane(order, lane || 'all'))
    total = matched.length
    const start = paginated ? rangeFrom : 0
    const end = paginated ? rangeTo + 1 : matched.length
    orders = matched.slice(start, end)
  }
  const orderIds = orders.map((order) => String(order.id))
  const [stockPostedIds, financePostedIds, fiscalRowsResult] = await Promise.all([
    mapSalesOrdersWithStockPosted(auth, orderIds),
    mapSalesOrdersWithFinancePosted(auth.supabase, auth.organizationId, orderIds),
    orderIds.length > 0
      ? auth.supabase
          .from('fiscal_documents')
          .select('id, sales_order_id, status, model')
          .eq('organization_id', auth.organizationId)
          .neq('status', 'canceled')
          .in('sales_order_id', orderIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])
  const nfceByOrder = new Map<string, { status: string, id: string }>()
  const nfeByOrder = new Map<string, { status: string, id: string }>()
  if (!fiscalRowsResult.error) {
    for (const row of fiscalRowsResult.data ?? []) {
      const salesOrderId = String(row.sales_order_id || '')
      if (!salesOrderId) continue
      const mapped = {
        status: String(row.status || 'pending'),
        id: String(row.id),
      }
      if (String(row.model) === '55') nfeByOrder.set(salesOrderId, mapped)
      else nfceByOrder.set(salesOrderId, mapped)
    }
  }

  const presentation = paginated
    ? await loadSalesOrderListPresentation({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      orders,
    })
    : null

  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => {
      const nfce = nfceByOrder.get(String(order.id))
      const nfe = nfeByOrder.get(String(order.id))
      const items = presentation?.itemsByOrderId.get(String(order.id)) ?? []
      return {
        ...order,
        has_stock_posted: stockPostedIds.has(String(order.id)),
        has_finance_posted: financePostedIds.has(String(order.id)),
        nfce_status: nfce?.status ?? null,
        nfce_document_id: nfce?.id ?? null,
        nfe_status: nfe?.status ?? null,
        nfe_document_id: nfe?.id ?? null,
        tax_cents: orderTaxCents(Number(order.total_cents) || 0, presentation?.marginTaxPercent ?? 0),
        items: items.map((item) => ({
          product_id: item.productId,
          name: item.name,
          sku: item.sku,
          image_url: item.imageUrl,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          cost_total_cents: item.costTotalCents,
          stock_current: item.stockCurrent,
          stock_after_sale: item.stockAfterSale,
        })),
      }
    }),
    total,
    page,
    pageSize: paginated ? pageSize : 200,
  })
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  const standalone = body?.standalone === true
  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await createSalesOrder(auth, items, draft, {
    attachCashSession: !standalone,
  })
  if (result.ok === false) {
    const status = result.error === 'cash_not_open' || result.error === 'invalid_product' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  const loaded = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, total_cents')
    .eq('organization_id', auth.organizationId)
    .eq('id', result.orderId)
    .single()

  return NextResponse.json({ ok: true, order_id: result.orderId, order: loaded.data })
}
