import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createPendingSale } from '@/lib/pdv/service'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const from = String(searchParams.get('from') || '').trim()
  const to = String(searchParams.get('to') || '').trim()
  const sellerUserId = String(searchParams.get('seller_user_id') || '').trim()
  const status = String(searchParams.get('status') || '').trim()

  let query = auth.supabase
    .from('pos_sales')
    .select('id, sale_number, status, seller_user_id, total_cents, paid_amount_cents, change_cents, created_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)
  if (sellerUserId) query = query.eq('seller_user_id', sellerUserId)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, sales: data ?? [], total: count ?? 0 })
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  const discountTotalCents = Math.max(0, Number(body?.discount_total_cents) || 0)

  const result = await createPendingSale(auth, items, discountTotalCents)
  if (result.ok === false) {
    const status = result.error === 'cash_not_open' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, sale_id: result.saleId })
}

