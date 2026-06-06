import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { replaceSalesOrderPayments } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const payments = Array.isArray(body?.payments) ? body.payments : []

  const { data: order } = await auth.supabase
    .from('sales_orders')
    .select('id, status')
    .eq('organization_id', auth.organizationId)
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (order.status !== 'in_progress') {
    return NextResponse.json({ ok: false, error: 'order_not_editable' }, { status: 400 })
  }

  const result = await replaceSalesOrderPayments(auth, id, payments)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
