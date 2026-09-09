import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { duplicateProduct } from '@/lib/products/service'

type Params = Promise<{ id: string }>

export async function POST (
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await duplicateProduct(id)
  if (result.ok === false) {
    const error = result.error
    const status =
      error === 'not_authenticated'
        ? 401
        : error === 'not_found'
          ? 404
          : 400
    return NextResponse.json({ ok: false, error }, { status })
  }

  return NextResponse.json({
    ok: true,
    product: {
      id: result.product.id,
      name: result.product.name,
      bling_id: null,
    },
  })
}
