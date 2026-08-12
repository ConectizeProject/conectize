import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  createSalesOrder,
  mapSalesOrdersWithFinancePosted,
  mapSalesOrdersWithStockPosted,
} from '@/lib/sales-orders/service'
import { getOpenCashSession } from '@/lib/pdv/service'

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
  const currentCash = searchParams.get('current_cash') === '1'

  let query = auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, seller_user_id, customer_name, customer_type, customer_document, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, bling_pedido_id, bling_nfce_id, created_at, updated_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)
  if (sellerUserId) query = query.eq('seller_user_id', sellerUserId)
  if (status) query = query.eq('status', status)

  if (currentCash) {
    const session = await getOpenCashSession(auth)
    if (!session.ok) {
      return NextResponse.json({ ok: true, orders: [], total: 0 })
    }
    query = query.eq('cash_session_id', session.session.id)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const orders = data ?? []
  const orderIds = orders.map((order) => String(order.id))
  const [stockPostedIds, financePostedIds] = await Promise.all([
    mapSalesOrdersWithStockPosted(auth, orderIds),
    mapSalesOrdersWithFinancePosted(auth.supabase, auth.organizationId, orderIds),
  ])

  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => ({
      ...order,
      has_stock_posted: stockPostedIds.has(String(order.id)),
      has_finance_posted: financePostedIds.has(String(order.id)),
    })),
    total: count ?? 0,
  })
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await createSalesOrder(auth, items, draft)
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
