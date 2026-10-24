import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { applyStaffProductPatchFromBody } from '@/lib/products/apply-staff-product-patch-body'
import {
  deleteProduct,
  getProductById,
  getProductByIdWithVariations,
  getProductCompatibleModelsForForm,
  type ProductServiceSession,
} from '@/lib/products/service'
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

  const session: ProductServiceSession = {
    supabase: auth.supabase,
    userId: auth.userId,
    organizationId: auth.organizationId,
  }

  // Custo de cadastro (`cost_price_cents`) intacto: a listagem usa
  // `resolveListDisplayCostCents` (última entrada), mas o formulário grava
  // `costPrice` no PATCH e marca edição manual. Substituir aqui apagava o
  // custo real ao salvar qualquer outro campo.
  const [result, compat] = await Promise.all([
    getProductByIdWithVariations(id, { session }),
    getProductCompatibleModelsForForm(id, session),
  ])

  if (result.ok && 'product' in result) {
    const { persistVirtualProductCostFromComponents } = await import(
      '@/lib/products/virtual-stock-cost'
    )
    const persisted = await persistVirtualProductCostFromComponents({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      productId: result.product.id,
    })
    result.product = {
      ...result.product,
      isVirtualStock: persisted.isVirtual,
      costPriceCents: persisted.isVirtual
        ? persisted.costPriceCents
        : result.product.costPriceCents,
    }
  }

  if (!result.ok) {
    const err = 'error' in result ? result.error : 'not_found'
    const status = err === 'not_authenticated' ? 401 : 404
    return NextResponse.json({
      ok: false,
      error: err,
    }, { status })
  }

  const compatibleModels = compat.ok ? compat.entries : []

  return NextResponse.json({
    ok: true,
    product: result.product,
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
    ...(result.message ? { message: result.message } : {}),
    ...(result.syncError ? { syncError: result.syncError } : {}),
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

