import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  createSalesOrder,
  mapSalesOrdersWithFinancePosted,
  mapSalesOrdersWithStockPosted,
} from '@/lib/sales-orders/service'
import { getOpenCashSession } from '@/lib/pdv/service'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const paymentMethodId = String(searchParams.get('payment_method_id') || '').trim()
  const currentCash = searchParams.get('current_cash') === '1'
  const pageParam = searchParams.get('page')
  const paginated = pageParam != null
  const page = paginated ? vendasListPage(pageParam) : 1
  const { from: rangeFrom, to: rangeTo, pageSize } = vendasListRange(page)

  let query = auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, seller_user_id, customer_name, customer_type, customer_document, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, bling_pedido_id, bling_nfce_id, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  if (paginated) query = query.range(rangeFrom, rangeTo)
  else query = query.limit(200)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)
  if (sellerUserId) query = query.eq('seller_user_id', sellerUserId)
  if (status) query = query.eq('status', status)

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
    query = query.in('id', matchingIds)
  }

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
    query = query.eq('cash_session_id', session.session.id)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const orders = data ?? []
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

  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => {
      const nfce = nfceByOrder.get(String(order.id))
      const nfe = nfeByOrder.get(String(order.id))
      return {
        ...order,
        has_stock_posted: stockPostedIds.has(String(order.id)),
        has_finance_posted: financePostedIds.has(String(order.id)),
        nfce_status: nfce?.status ?? null,
        nfce_document_id: nfce?.id ?? null,
        nfe_status: nfe?.status ?? null,
        nfe_document_id: nfe?.id ?? null,
      }
    }),
    total: count ?? 0,
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
