import { NextRequest, NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { deleteProduct, getProductById, getProductByIdWithVariations } from '@/lib/products/service'
import { syncProductToBling, updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

export async function GET (
  _request: NextRequest,
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

  const result = await getProductByIdWithVariations(id)
  if (!result.ok) {
    const err = 'error' in result ? result.error : 'not_found'
    const status = err === 'not_authenticated' ? 401 : 404
    return NextResponse.json({
      ok: false,
      error: err,
    }, { status })
  }

  return NextResponse.json({
    ok: true,
    product: result.product,
    variations: result.variations,
  })
}

function parseTextField (body: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { hasValue: false as const }

  const value = body[key]
  if (value === null) {
    return { hasValue: true as const, value: null }
  }
  if (typeof value !== 'string') {
    return { hasValue: true as const, error: `${key}_invalid` }
  }

  return { hasValue: true as const, value }
}

function parseMoneyField (body: Record<string, unknown>, key: string) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return { hasValue: false as const }

  const rawValue = body[key]
  if (rawValue === null || rawValue === '') {
    return { hasValue: true as const, value: null }
  }

  const numericValue = typeof rawValue === 'number'
    ? rawValue
    : typeof rawValue === 'string'
      ? Number(rawValue.replace(',', '.'))
      : Number.NaN

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { hasValue: true as const, error: `${key}_invalid` }
  }

  return {
    hasValue: true as const,
    value: Math.round(numericValue * 100),
  }
}

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

  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  const patch: {
    salePriceCents?: number | null
    costPriceCents?: number | null
    name?: string
    sku?: string | null
    barcode?: string | null
    description?: string | null
    isActive?: boolean
    kind?: 'product' | 'service' | null
  } = {}

  const salePriceField = parseMoneyField(body, 'salePrice')
  if ('error' in salePriceField) {
    return NextResponse.json({ ok: false, error: salePriceField.error }, { status: 400 })
  }
  if (salePriceField.hasValue) {
    patch.salePriceCents = salePriceField.value
  }

  const costPriceField = parseMoneyField(body, 'costPrice')
  if ('error' in costPriceField) {
    return NextResponse.json({ ok: false, error: costPriceField.error }, { status: 400 })
  }
  if (costPriceField.hasValue) {
    patch.costPriceCents = costPriceField.value
  }

  const nameField = parseTextField(body, 'name')
  if ('error' in nameField) {
    return NextResponse.json({ ok: false, error: nameField.error }, { status: 400 })
  }
  if (nameField.hasValue) {
    patch.name = nameField.value ?? ''
  }

  const skuField = parseTextField(body, 'sku')
  if ('error' in skuField) {
    return NextResponse.json({ ok: false, error: skuField.error }, { status: 400 })
  }
  if (skuField.hasValue) {
    patch.sku = skuField.value
  }

  const barcodeField = parseTextField(body, 'barcode')
  if ('error' in barcodeField) {
    return NextResponse.json({ ok: false, error: barcodeField.error }, { status: 400 })
  }
  if (barcodeField.hasValue) {
    patch.barcode = barcodeField.value
  }

  const descriptionField = parseTextField(body, 'description')
  if ('error' in descriptionField) {
    return NextResponse.json({ ok: false, error: descriptionField.error }, { status: 400 })
  }
  if (descriptionField.hasValue) {
    patch.description = descriptionField.value
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'isActive_invalid' }, { status: 400 })
    }

    patch.isActive = body.isActive
  }

  if (Object.prototype.hasOwnProperty.call(body, 'kind')) {
    const kind = body.kind
    if (kind !== null && kind !== 'product' && kind !== 'service') {
      return NextResponse.json({ ok: false, error: 'kind_invalid' }, { status: 400 })
    }

    patch.kind = kind as 'product' | 'service' | null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  const result = await updateProductAndSyncBling(id, patch)
  if (!result.ok && 'error' in result) {
    const status = result.error === 'bling_request_failed' ? 502 : 400
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: result.message,
    }, { status })
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    product: result.product,
    syncedToBling: result.syncedToBling,
    pendingSyncToBling: result.product.blingSyncPending,
    blingFieldsChanged: result.blingFieldsChanged,
  })
}

export async function DELETE (
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

  const body = await request.json().catch(() => ({})) as { inactivateOnBling?: unknown }
  const inactivateOnBling = Boolean(body?.inactivateOnBling)

  const current = await getProductById(id)
  if (!current.ok || !('product' in current)) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const hadBling = Boolean(
    current.product.blingId && String(current.product.blingId).trim(),
  )

  const del = await deleteProduct(id)
  if (!del.ok) {
    const err = 'error' in del ? del.error : 'db_error'
    const status = err === 'not_authenticated' ? 401 : 500
    return NextResponse.json({ ok: false, error: err }, { status })
  }

  let blingInactivated = false
  let blingError: string | undefined

  if (inactivateOnBling && hadBling) {
    const sync = await syncProductToBling(id, { portalFieldsChanged: ['isActive'] })
    if (!sync.ok && 'error' in sync) {
      blingError = sync.message ?? sync.error
    } else {
      blingInactivated = true
    }
  }

  return NextResponse.json({
    ok: true,
    blingInactivated,
    ...(blingError ? { blingError } : {}),
  })
}

