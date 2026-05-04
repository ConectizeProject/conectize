import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getOpenCashSession } from '@/lib/pdv/service'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await getOpenCashSession(auth)
  if (!result.ok) return NextResponse.json({ ok: true, session: null })

  return NextResponse.json({ ok: true, session: result.session })
}

