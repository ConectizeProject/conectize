import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { finalizeSalesOrder } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const changeCents = body?.change_cents != null ? Number(body.change_cents) : undefined
  const result = await finalizeSalesOrder(auth, id, {
    change_cents: Number.isFinite(changeCents) ? changeCents : undefined,
  })
  if (result.ok === false) {
    const status = result.error === 'payment_insufficient' || result.error === 'order_canceled' || result.error === 'empty_order' || result.error === 'finance_sync_failed' ? 400 : result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error, details: result }, { status })
  }

  if (!('order' in result)) {
    return NextResponse.json({ ok: false, error: 'unexpected_result' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: result.order })
}
