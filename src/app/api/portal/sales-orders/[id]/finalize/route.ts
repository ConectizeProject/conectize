import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { finalizeSalesOrder } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await finalizeSalesOrder(auth, id)
  if (!result.ok) {
    const status = result.error === 'stock_unavailable' || result.error === 'payment_insufficient' || result.error === 'order_canceled' || result.error === 'empty_order' ? 400 : result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error, details: result }, { status })
  }

  if (!('order' in result)) {
    return NextResponse.json({ ok: false, error: 'unexpected_result' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: result.order })
}
