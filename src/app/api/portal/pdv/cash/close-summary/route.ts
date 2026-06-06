import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { buildCashCloseSummary } from '@/lib/pdv/cash-close-summary'
import { getOpenCashSession } from '@/lib/pdv/service'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const current = await getOpenCashSession(auth)
  if (!current.ok) {
    return NextResponse.json({ ok: false, error: 'cash_not_open' }, { status: 400 })
  }

  const result = await buildCashCloseSummary(auth, current.session)
  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, summary: result.summary })
}
