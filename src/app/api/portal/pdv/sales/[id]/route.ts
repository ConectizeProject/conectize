import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { loadSale } from '@/lib/pdv/service'

type Params = Promise<{ id: string }>

export async function GET (_request: Request, { params }: { params: Params }) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await loadSale(auth, id)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({ ok: true, sale: result.sale, items: result.items, payments: result.payments })
}

