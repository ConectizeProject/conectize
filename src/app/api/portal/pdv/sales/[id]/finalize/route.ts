import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { finalizeSale } from '@/lib/pdv/service'

type Params = Promise<{ id: string }>

export async function POST (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await finalizeSale(auth, id)
  if (result.ok === false) {
    const status = result.error === 'payment_insufficient' || result.error === 'sale_canceled' ? 400 : 500
    return NextResponse.json({ ok: false, error: result.error, details: result }, { status })
  }

  if (!('sale' in result)) {
    return NextResponse.json({ ok: false, error: 'unexpected_result' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sale: result.sale })
}

