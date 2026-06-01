import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { cancelSalesOrder } from '@/lib/sales-orders/service'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const reason = String(body?.reason || '').trim() || null

  const result = await cancelSalesOrder(auth, id, reason)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'order_not_editable' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
