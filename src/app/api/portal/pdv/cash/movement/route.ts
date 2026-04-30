import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getOpenCashSession } from '@/lib/pdv/service'

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const current = await getOpenCashSession(auth)
  if (!current.ok) {
    return NextResponse.json({ ok: false, error: 'cash_not_open' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const type = body?.type === 'suprimento' ? 'suprimento' : body?.type === 'sangria' ? 'sangria' : null
  const amountCents = Math.max(0, Number(body?.amount_cents) || 0)
  const reason = String(body?.reason || '').trim() || null

  if (!type) return NextResponse.json({ ok: false, error: 'type_invalid' }, { status: 400 })
  if (amountCents <= 0) return NextResponse.json({ ok: false, error: 'amount_invalid' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('pos_cash_movements')
    .insert({
      organization_id: auth.organizationId,
      cash_session_id: current.session.id,
      type,
      amount_cents: amountCents,
      reason,
      created_by: auth.userId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true, movement: data })
}

