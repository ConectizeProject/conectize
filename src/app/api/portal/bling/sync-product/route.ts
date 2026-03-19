import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import {
  getProductById,
  updateProduct,
  getProductCurrentStock,
  addStockMovement,
} from '@/lib/products/service'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'
import {
  getVirtualStockTargetFromMappedProduct,
  getVirtualStockFromEstoqueApiResponse,
} from '@/lib/integrations/bling/stock-reconcile'

export async function POST (request: Request) {
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { productId?: string }
  const productId = String(body.productId || '').trim()
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'product_id_required' }, { status: 400 })
  }

  const current = await getProductById(productId)
  if (!current.ok || !('product' in current)) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  if (!current.product.blingId) {
    return NextResponse.json({ ok: false, error: 'product_not_linked_bling' }, { status: 400 })
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  try {
    const data = await clientRes.client.request<{
      data?: Record<string, unknown>
    } | Record<string, unknown>>({
      method: 'GET',
      path: `/produtos/${current.product.blingId}`,
    })

    const dto = data?.data ?? data ?? {}

    const local = mapBlingProductToLocal(dto)
    await updateProduct(productId, {
      name: local.name,
      sku: local.sku ?? undefined,
      barcode: local.barcode ?? undefined,
      description: local.description ?? undefined,
      salePriceCents: local.salePriceCents ?? undefined,
      costPriceCents: local.costPriceCents ?? undefined,
      isActive: local.isActive ?? undefined,
      blingId: local.blingId ?? undefined,
      blingSyncPending: false,
      blingSyncSnapshot: createProductSyncSnapshot(local),
      kind: local.kind ?? undefined,
    })

    const effectiveKind = local.kind ?? current.product.kind
    let stockAdjustedBy: number | null = null
    if (effectiveKind !== 'service') {
      let targetVirtual = getVirtualStockTargetFromMappedProduct(local)
      if (targetVirtual === null) {
        const estoqueRes = await clientRes.client.request<unknown>({
          method: 'GET',
          path: `/produtos/${current.product.blingId}/estoque`,
        })
        targetVirtual = getVirtualStockFromEstoqueApiResponse(estoqueRes)
      }
      if (targetVirtual !== null) {
        const stockRes = await getProductCurrentStock(productId)
        const balance = stockRes.ok && 'currentStock' in stockRes ? stockRes.currentStock : 0
        const diff = targetVirtual - balance
        stockAdjustedBy = diff
        if (diff !== 0) {
          const unitCents = local.costPriceCents
            ?? current.product.costPriceCents
            ?? current.product.salePriceCents
            ?? 0
          const movRes = await addStockMovement(productId, {
            type: diff > 0 ? 'entry' : 'exit',
            quantity: Math.abs(diff),
            unitValueCents: unitCents,
            source: 'bling',
            externalReference: `bling:atualizar-pelo-bling:${productId}`,
          })
          if (!movRes.ok) {
            return NextResponse.json(
              { ok: false, error: 'stock_reconcile_failed', detail: 'error' in movRes ? movRes.error : 'db_error' },
              { status: 500 },
            )
          }
        }
      }
    }

    return NextResponse.json({ ok: true, stockAdjustedBy })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
  }
}

