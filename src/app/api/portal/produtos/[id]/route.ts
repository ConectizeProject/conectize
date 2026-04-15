import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  deleteProduct,
  getProductById,
  getProductByIdWithVariations,
  getProductCompatibleModelsForForm,
  replaceProductCompatibleDeviceModels,
  type Product,
  type UpdateProductInput,
} from '@/lib/products/service'
import type { PortalFieldForBling } from '@/lib/products/bling-sync'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'
import { syncProductToBling, updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET (
  _request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
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

  const { data: lastEntryRow } = await auth.supabase
    .from('product_stock_movements')
    .select('unit_value_cents, created_at')
    .eq('product_id', id)
    .eq('type', 'entry')
    .gt('unit_value_cents', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastEntry = lastEntryRow as { unit_value_cents?: number; created_at?: string } | null
  const lastEntryMs =
    lastEntry?.created_at != null
      ? new Date(String(lastEntry.created_at)).getTime()
      : null
  const lastEntryCents =
    typeof lastEntry?.unit_value_cents === 'number'
      ? lastEntry.unit_value_cents
      : null

  const product = {
    ...result.product,
    costPriceCents: resolveListDisplayCostCents({
      costPriceCents: result.product.costPriceCents,
      costPriceManualEditedAt: result.product.costPriceManualEditedAt,
      lastEntryUnitValueCents: lastEntryCents,
      lastEntryTimeMs: lastEntryMs,
    }),
  }

  const compat = await getProductCompatibleModelsForForm(id)
  const compatibleModels = compat.ok ? compat.entries : []

  return NextResponse.json({
    ok: true,
    product,
    variations: result.variations,
    compatibleModels,
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
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  const patch: UpdateProductInput = {}

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

  if (Object.prototype.hasOwnProperty.call(body, 'pricingTagId')) {
    const raw = body.pricingTagId
    if (raw === null || raw === '') {
      patch.pricingTagId = null
    } else {
      const s = String(raw).trim().toLowerCase()
      if (!UUID_RE.test(s)) {
        return NextResponse.json({ ok: false, error: 'pricingTagId_invalid' }, { status: 400 })
      }
      patch.pricingTagId = s
    }
  }

  let compatibleIds: string[] | null = null
  if (Object.prototype.hasOwnProperty.call(body, 'compatibleModelIds')) {
    const raw = body.compatibleModelIds
    if (!Array.isArray(raw)) {
      return NextResponse.json({ ok: false, error: 'compatibleModelIds_invalid' }, { status: 400 })
    }
    compatibleIds = [
      ...new Set(
        raw
          .map((x) => String(x || '').trim().toLowerCase())
          .filter((x) => UUID_RE.test(x)),
      ),
    ]
  }

  const hasProductPatch = Object.keys(patch).length > 0
  const hasCompatUpdate = compatibleIds !== null

  if (!hasProductPatch && !hasCompatUpdate) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  let syncedToBling = false
  let blingFieldsChanged: PortalFieldForBling[] | undefined
  let midProduct: Product

  if (hasProductPatch) {
    const upd = await updateProductAndSyncBling(id, patch)
    if (!upd.ok && 'error' in upd) {
      const status = upd.error === 'bling_request_failed' ? 502 : 400
      return NextResponse.json({
        ok: false,
        error: upd.error,
        message: upd.message,
      }, { status })
    }
    if (!upd.ok) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 400 })
    }
    syncedToBling = upd.syncedToBling
    blingFieldsChanged = upd.blingFieldsChanged
    midProduct = upd.product
  } else {
    const cur = await getProductById(id)
    if (!cur.ok || !('product' in cur)) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    midProduct = cur.product
  }

  if (hasCompatUpdate && compatibleIds) {
    const rep = await replaceProductCompatibleDeviceModels(id, compatibleIds)
    if (!rep.ok) {
      return NextResponse.json({ ok: false, error: 'compatible_models_failed' }, { status: 500 })
    }
  }

  const fresh = await getProductById(id)
  const productOut = fresh.ok && 'product' in fresh ? fresh.product : midProduct

  return NextResponse.json({
    ok: true,
    product: productOut,
    syncedToBling,
    pendingSyncToBling: productOut.blingSyncPending,
    blingFieldsChanged,
  })
}

export async function DELETE (
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
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

