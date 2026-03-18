import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import {
  getProductCurrentStock,
  listStockMovements,
  addStockMovement,
  type StockMovementType,
} from '@/lib/products/service'

type Params = Promise<{ id: string }>

export async function GET (
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [stockRes, movementsRes] = await Promise.all([
    getProductCurrentStock(id),
    listStockMovements(id),
  ])

  if (!stockRes.ok) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 })
  }
  if (!movementsRes.ok) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    currentStock: stockRes.currentStock ?? 0,
    movements: movementsRes.items,
  })
}

export async function POST (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    type?: string
    quantity?: number
    unitValueCents?: number
  }
  const type = (String(body.type || 'entry').trim() || 'entry') as StockMovementType
  if (!['entry', 'exit', 'loss'].includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'invalid_quantity' }, { status: 400 })
  }
  const unitValueCents = typeof body.unitValueCents === 'number' && body.unitValueCents >= 0
    ? Math.round(body.unitValueCents)
    : undefined

  const result = await addStockMovement(id, {
    type,
    quantity,
    unitValueCents: unitValueCents ?? null,
    source: 'manual',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    currentStock: result.currentStock ?? null,
    movement: result.movement,
  })
}
