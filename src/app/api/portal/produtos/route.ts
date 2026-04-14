import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { addStockMovement, createProduct } from '@/lib/products/service'

function parseMoneyToCents (raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function parseNonNegativeNumber (raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const name = String(body.name || '').trim()
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
  }

  const kindRaw = String(body.kind || '').trim()
  const kind = kindRaw === 'service' ? 'service' : 'product'
  const salePriceCents = parseMoneyToCents(body.salePrice)
  const costPriceCents = parseMoneyToCents(body.costPrice)
  if (body.salePrice != null && body.salePrice !== '' && salePriceCents == null) {
    return NextResponse.json({ ok: false, error: 'salePrice_invalid' }, { status: 400 })
  }
  if (body.costPrice != null && body.costPrice !== '' && costPriceCents == null) {
    return NextResponse.json({ ok: false, error: 'costPrice_invalid' }, { status: 400 })
  }

  const initialStockRaw = parseNonNegativeNumber(body.initialStock)
  if (body.initialStock != null && body.initialStock !== '' && initialStockRaw == null) {
    return NextResponse.json({ ok: false, error: 'initialStock_invalid' }, { status: 400 })
  }
  const initialStock = initialStockRaw ?? 0

  const created = await createProduct({
    name,
    kind,
    sku: String(body.sku || '').trim() || null,
    barcode: String(body.barcode || '').trim() || null,
    description: String(body.description || '').trim() || null,
    salePriceCents,
    costPriceCents,
    isActive: body.isActive !== false,
  })

  if (!created.ok || !('product' in created)) {
    return NextResponse.json(
      { ok: false, error: 'error' in created ? created.error : 'db_error' },
      { status: 400 },
    )
  }

  if (kind !== 'service' && initialStock > 0) {
    const stockRes = await addStockMovement(created.product.id, {
      type: 'entry',
      quantity: initialStock,
      unitValueCents: created.product.costPriceCents ?? created.product.salePriceCents ?? 0,
      source: 'system',
    })
    if (!stockRes.ok) {
      return NextResponse.json({
        ok: false,
        error: 'stock_movement_failed',
      }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, product: created.product })
}

