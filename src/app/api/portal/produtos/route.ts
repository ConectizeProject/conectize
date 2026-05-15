import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  parseVariationAttributeKeys,
  parseVariationAttributeValues,
} from '@/lib/products/variation-display-name'
import { addStockMovement, createProduct, replaceProductCompatibleDeviceModels } from '@/lib/products/service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  let pricingTagId: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'pricingTagId')) {
    const raw = body.pricingTagId
    if (raw === null || raw === '') pricingTagId = null
    else {
      const s = String(raw).trim().toLowerCase()
      if (!UUID_RE.test(s)) {
        return NextResponse.json({ ok: false, error: 'pricingTagId_invalid' }, { status: 400 })
      }
      pricingTagId = s
    }
  }

  let parentProductId: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'parentProductId')) {
    const raw = body.parentProductId
    if (raw === null || raw === '') parentProductId = null
    else {
      const s = String(raw).trim().toLowerCase()
      if (!UUID_RE.test(s)) {
        return NextResponse.json({ ok: false, error: 'parentProductId_invalid' }, { status: 400 })
      }
      parentProductId = s
    }
  }

  let parentBlingId: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'parentBlingId')) {
    const raw = body.parentBlingId
    parentBlingId = raw == null ? null : (String(raw).trim() || null)
  }

  let variationAttributeKeys: string[] | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'variationAttributeKeys')) {
    variationAttributeKeys = parseVariationAttributeKeys(body.variationAttributeKeys)
  }

  let variationAttributeValues: Record<string, string> | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'variationAttributeValues')) {
    variationAttributeValues = parseVariationAttributeValues(body.variationAttributeValues)
  }

  let imageUrl: string | null | undefined
  if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    const raw = body.imageUrl
    if (raw === null) imageUrl = null
    else if (typeof raw === 'string') imageUrl = raw.trim() || null
    else {
      return NextResponse.json({ ok: false, error: 'imageUrl_invalid' }, { status: 400 })
    }
  }

  const created = await createProduct({
    name,
    kind,
    sku: String(body.sku || '').trim() || null,
    barcode: String(body.barcode || '').trim() || null,
    description: String(body.description || '').trim() || null,
    salePriceCents,
    costPriceCents,
    isActive: body.isActive !== false,
    ...(pricingTagId !== undefined ? { pricingTagId } : {}),
    ...(parentProductId !== undefined ? { parentProductId } : {}),
    ...(parentBlingId !== undefined ? { parentBlingId } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(variationAttributeKeys !== undefined ? { variationAttributeKeys } : {}),
    ...(variationAttributeValues !== undefined ? { variationAttributeValues } : {}),
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

  if (Array.isArray(body.compatibleModelIds) && body.compatibleModelIds.length > 0) {
    const ids = [
      ...new Set(
        body.compatibleModelIds
          .map((x) => String(x || '').trim().toLowerCase())
          .filter((x) => UUID_RE.test(x)),
      ),
    ]
    if (ids.length > 0) {
      const linkRes = await replaceProductCompatibleDeviceModels(created.product.id, ids)
      if (!linkRes.ok) {
        return NextResponse.json({ ok: false, error: 'compatible_models_failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true, product: created.product })
}

