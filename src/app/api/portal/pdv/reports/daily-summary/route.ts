import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const date = String(searchParams.get('date') || new Date().toISOString().slice(0, 10))

  const { data: orders, error } = await auth.supabase
    .from('sales_orders')
    .select('id, status, total_cents, paid_amount_cents, change_cents')
    .eq('organization_id', auth.organizationId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const paidOrders = (orders ?? []).filter((order) => order.status === 'paid')
  const totalSalesCents = paidOrders.reduce((acc, order) => acc + (Number(order.total_cents) || 0), 0)
  const totalReceivedCents = paidOrders.reduce((acc, order) => acc + (Number(order.paid_amount_cents) || 0), 0)
  const totalChangeCents = paidOrders.reduce((acc, order) => acc + (Number(order.change_cents) || 0), 0)

  const paidIds = paidOrders.map((order) => String(order.id))
  const byMethod: Record<string, number> = { dinheiro: 0, pix: 0, credito: 0, debito: 0, outro: 0 }

  if (paidIds.length > 0) {
    const { data: payments } = await auth.supabase
      .from('sales_order_payments')
      .select('sales_order_id, payment_method_type, amount_cents, status')
      .eq('organization_id', auth.organizationId)
      .in('sales_order_id', paidIds)

    for (const row of payments ?? []) {
      if ((row.status ?? 'paid') === 'canceled') continue
      const type = String(row.payment_method_type || 'outro')
      byMethod[type] = (byMethod[type] || 0) + (Number(row.amount_cents) || 0)
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      date,
      paidSalesCount: paidOrders.length,
      canceledSalesCount: (orders ?? []).filter((order) => order.status === 'canceled').length,
      inProgressCount: (orders ?? []).filter((order) => order.status === 'in_progress').length,
      totalSalesCents,
      totalReceivedCents,
      totalChangeCents,
      byMethod,
    },
  })
}
