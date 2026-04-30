import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { replaceSalePayments } from '@/lib/pdv/service'

type Params = Promise<{ id: string }>

export async function POST (request: NextRequest, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const payments = Array.isArray(body?.payments) ? body.payments : []

  const result = await replaceSalePayments(auth, id, payments)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 })

  return NextResponse.json({ ok: true })
}

