import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  getProductById,
  getProductCurrentStock,
  listStockMovements,
  addStockMovement,
  deleteStockMovement,
  type StockMovementType,
} from '@/lib/products/service'
import { fetchProductHasVariationChildren } from '@/lib/products/parent-has-variations'
import {
  PORTAL_STOCK_EXTERNAL_REF_PREFIX,
  pushStockMovementToBling,
} from '@/lib/integrations/bling/push-stock-movement'

type Params = Promise<{ id: string }>

export async function GET (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const pageRaw = Number(url.searchParams.get('page') || '1')
  const pageSizeRaw = Number(url.searchParams.get('pageSize') || '20')
  const page = Number.isFinite(pageRaw) ? pageRaw : 1
  const pageSize = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20

  const [stockRes, movementsRes] = await Promise.all([
    getProductCurrentStock(id),
    listStockMovements(id, { page, pageSize }),
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
    total: movementsRes.total,
    page: movementsRes.page,
    pageSize: movementsRes.pageSize,
  })
}

export async function POST (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({})) as {
    type?: string
    quantity?: number
    unitValueCents?: number
  }
  const type = (String(body.type || 'entry').trim() || 'entry') as StockMovementType | 'balance'
  if (!['entry', 'exit', 'loss', 'balance'].includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || (type !== 'balance' && quantity <= 0) || (type === 'balance' && quantity < 0)) {
    return NextResponse.json({ error: 'invalid_quantity' }, { status: 400 })
  }
  const unitValueCents = typeof body.unitValueCents === 'number' && body.unitValueCents >= 0
    ? Math.round(body.unitValueCents)
    : undefined

  const productRes = await getProductById(id)
  if (!productRes.ok || !('product' in productRes)) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 })
  }

  const product = productRes.product
  if (product.kind === 'service') {
    return NextResponse.json(
      {
        error: 'service_no_stock',
        message: 'Serviço não possui estoque.',
      },
      { status: 400 },
    )
  }
  if (await fetchProductHasVariationChildren(auth.supabase, id)) {
    return NextResponse.json(
      {
        error: 'parent_product_no_stock',
        message: 'Produto pai não possui estoque. O saldo fica nas variações.',
      },
      { status: 400 },
    )
  }
  const portalStockRef = `${PORTAL_STOCK_EXTERNAL_REF_PREFIX}${crypto.randomUUID()}`

  let blingPushError: string | null = null
  async function pushToBling (
    pushType: StockMovementType | 'balance',
    qty: number,
    observacoes?: string,
  ) {
    if (!product.blingId) return
    try {
      await pushStockMovementToBling({
        productBlingId: product.blingId,
        type: pushType,
        quantity: qty,
        unitValueCents: unitValueCents ?? null,
        observacoes,
      })
    } catch (err) {
      blingPushError = err instanceof Error ? err.message : 'error'
    }
  }

  if (type === 'balance') {
    const localBalanceRes = await getProductCurrentStock(id)
    const localBalance = localBalanceRes.ok ? localBalanceRes.currentStock : 0
    const target = quantity
    const diff = target - localBalance

    if (diff === 0) {
      await pushToBling(type, target, 'Balanço (portal)')
      return NextResponse.json({
        ok: true,
        currentStock: target,
        movement: null,
        blingPushError,
      })
    }

    const movementType: StockMovementType = diff > 0 ? 'entry' : 'exit'
    const qtyToInsert = Math.abs(diff)

    const result = await addStockMovement(id, {
      type: movementType,
      quantity: qtyToInsert,
      unitValueCents: unitValueCents ?? null,
      source: 'manual',
      externalReference: portalStockRef,
    })

    if (!result.ok) {
      return NextResponse.json({ error: 'error' in result ? result.error : 'db_error' }, { status: 400 })
    }

    await pushToBling(type, target, 'Balanço (portal)')

    return NextResponse.json({
      ok: true,
      currentStock: result.currentStock ?? null,
      movement: result.movement,
      blingPushError,
    })
  }

  const result = await addStockMovement(id, {
    type,
    quantity,
    unitValueCents: unitValueCents ?? null,
    source: 'manual',
    externalReference: portalStockRef,
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'error' in result ? result.error : 'db_error' }, { status: 400 })
  }

  const pushType = type === 'loss' ? 'exit' : type
  await pushToBling(pushType, quantity, type === 'loss' ? 'Perda (portal)' : undefined)

  return NextResponse.json({
    ok: true,
    currentStock: result.currentStock ?? null,
    movement: result.movement,
    blingPushError,
  })
}

export async function DELETE (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const movementId = String(url.searchParams.get('movementId') || '').trim()
  if (!movementId) {
    return NextResponse.json({ error: 'movement_id_required' }, { status: 400 })
  }

  const result = await deleteStockMovement(id, movementId)
  if (result.ok === false) {
    const status = result.error === 'not_authenticated'
      ? 401
      : result.error === 'not_found'
        ? 404
        : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    currentStock: result.currentStock,
  })
}
