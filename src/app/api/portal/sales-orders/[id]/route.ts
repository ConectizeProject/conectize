import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { loadSalesOrder, updateSalesOrderDraft } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function GET (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await loadSalesOrder(auth, id)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, order: result.order, items: result.items, payments: result.payments })
}

export async function PATCH (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : undefined
  const draft = {
    customer_name: body?.customer_name ?? undefined,
    customer_type: body?.customer_type ?? undefined,
    customer_document: body?.customer_document ?? undefined,
    discount_total_cents: body?.discount_total_cents ?? undefined,
    surcharge_cents: body?.surcharge_cents ?? undefined,
  }

  const result = await updateSalesOrderDraft(auth, id, draft, items)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'order_not_editable' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  const loaded = await loadSalesOrder(auth, id)
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: loaded.order, items: loaded.items, payments: loaded.payments })
}
