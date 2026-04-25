import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { applyStaffProductPatchFromBody } from '@/lib/products/apply-staff-product-patch-body'
import {
  deleteProduct,
  getProductById,
  getProductByIdWithVariations,
  getProductCompatibleModelsForForm,
} from '@/lib/products/service'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'
import { syncProductToBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

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

  const result = await applyStaffProductPatchFromBody(id, body)
  if (result.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.message ? { message: result.message } : {}),
      },
      { status: result.status },
    )
  }

  return NextResponse.json({
    ok: true,
    product: result.product,
    syncedToBling: result.syncedToBling,
    pendingSyncToBling: result.pendingSyncToBling,
    blingFieldsChanged: result.blingFieldsChanged,
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

