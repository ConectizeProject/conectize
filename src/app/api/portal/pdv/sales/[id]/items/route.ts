import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { calcSaleTotals, loadSale, replaceSaleItems } from '@/lib/pdv/service'

type Params = Promise<{ id: string }>

export async function PATCH (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []

  const updated = await replaceSaleItems(auth, id, items)
  if (!updated.ok) {
    const status = updated.error === 'invalid_product' ? 400 : 500
    return NextResponse.json({ ok: false, error: updated.error }, { status })
  }

  const sale = await loadSale(auth, id)
  if (!sale.ok) return NextResponse.json({ ok: false, error: sale.error }, { status: 500 })

  const totals = calcSaleTotals(items, sale.sale.discount_total_cents || 0)
  const { error } = await auth.supabase
    .from('pos_sales')
    .update({
      subtotal_cents: totals.subtotalCents,
      total_cents: totals.totalCents,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', id)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

