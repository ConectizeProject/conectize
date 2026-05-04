import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getOpenCashSession } from '@/lib/pdv/service'

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const already = await getOpenCashSession(auth)
  if (already.ok) {
    return NextResponse.json({ ok: false, error: 'cash_already_open' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const openingAmountCents = Math.max(0, Number(body?.opening_amount_cents) || 0)
  const notes = String(body?.notes || '').trim() || null

  const { data, error } = await auth.supabase
    .from('pos_cash_sessions')
    .insert({
      organization_id: auth.organizationId,
      opened_by: auth.userId,
      opening_amount_cents: openingAmountCents,
      notes,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, session: data })
}

