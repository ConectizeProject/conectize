import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const date = String(searchParams.get('date') || new Date().toISOString().slice(0, 10))

  const { data: sales, error } = await auth.supabase
    .from('pos_sales')
    .select('id, status, total_cents, paid_amount_cents, change_cents')
    .eq('organization_id', auth.organizationId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const paidSales = (sales ?? []).filter((sale) => sale.status === 'paid')
  const totalSalesCents = paidSales.reduce((acc, sale) => acc + (Number(sale.total_cents) || 0), 0)
  const totalReceivedCents = paidSales.reduce((acc, sale) => acc + (Number(sale.paid_amount_cents) || 0), 0)
  const totalChangeCents = paidSales.reduce((acc, sale) => acc + (Number(sale.change_cents) || 0), 0)

  const { data: payments } = await auth.supabase
    .from('pos_sale_payments')
    .select('sale_id, payment_method_type, amount_cents')
    .eq('organization_id', auth.organizationId)

  const paidIds = new Set(paidSales.map((sale) => String(sale.id)))
  const byMethod: Record<string, number> = { dinheiro: 0, pix: 0, credito: 0, debito: 0, outro: 0 }
  for (const row of payments ?? []) {
    if (!paidIds.has(String(row.sale_id))) continue
    const type = String(row.payment_method_type || 'outro')
    byMethod[type] = (byMethod[type] || 0) + (Number(row.amount_cents) || 0)
  }

  return NextResponse.json({
    ok: true,
    summary: {
      date,
      paidSalesCount: paidSales.length,
      canceledSalesCount: (sales ?? []).filter((sale) => sale.status === 'canceled').length,
      totalSalesCents,
      totalReceivedCents,
      totalChangeCents,
      byMethod,
    },
  })
}

