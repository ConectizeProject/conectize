import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { calcSaleTotals, listSaleItems } from '@/lib/pdv/service'

type Params = Promise<{ id: string }>

export async function PATCH (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const discountTotalCents = Math.max(0, Number(body?.discount_total_cents) || 0)

  const itemsRes = await listSaleItems(auth, id)
  if (!itemsRes.ok) return NextResponse.json({ ok: false, error: itemsRes.error }, { status: 500 })

  const totals = calcSaleTotals(itemsRes.items, discountTotalCents)

  const { error } = await auth.supabase
    .from('pos_sales')
    .update({
      discount_total_cents: totals.discountTotalCents,
      total_cents: totals.totalCents,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', id)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

