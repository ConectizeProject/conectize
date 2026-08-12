import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { checkoutSalesOrder } from '@/lib/sales-orders/service'

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  const payments = Array.isArray(body?.payments) ? body.payments : []
  const orderId = body?.order_id != null ? String(body.order_id) : null
  const changeCents = body?.change_cents != null ? Number(body.change_cents) : undefined

  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await checkoutSalesOrder(auth, {
    orderId,
    items,
    draft,
    payments,
    change_cents: Number.isFinite(changeCents) ? changeCents : undefined,
  })

  if (!result.ok) {
    const error = result.error
    const status = error === 'payment_insufficient'
      || error === 'order_canceled'
      || error === 'empty_order'
      || error === 'finance_sync_failed'
      || error === 'cash_not_open'
      || error === 'invalid_product'
      || error === 'order_not_editable'
      ? 400
      : error === 'not_found'
        ? 404
        : 500

    return NextResponse.json({
      ok: false,
      error,
      order_id: result.orderId,
      details: 'details' in result ? result.details : undefined,
    }, { status })
  }

  return NextResponse.json({
    ok: true,
    order_id: result.orderId,
    order: result.order,
  })
}
