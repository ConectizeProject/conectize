import { NextRequest, NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { updateProduct } from '@/lib/products/service'

type Params = Promise<{ id: string }>

export async function PATCH (
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    salePrice?: number
    name?: string
    isActive?: boolean
  }

  const patch: {
    salePriceCents?: number | null
    name?: string
    isActive?: boolean
  } = {}

  if (typeof body.salePrice === 'number' && body.salePrice >= 0) {
    patch.salePriceCents = Math.round(body.salePrice * 100)
  }
  if (typeof body.name === 'string') {
    patch.name = body.name
  }
  if (typeof body.isActive === 'boolean') {
    patch.isActive = body.isActive
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  const result = await updateProduct(id, patch)
  if (!result.ok || !result.product) {
    return NextResponse.json({ ok: false, error: result.error ?? 'db_error' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, product: result.product })
}

