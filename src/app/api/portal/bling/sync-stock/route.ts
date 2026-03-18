import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { getProductById, listStockMovements, addStockMovement } from '@/lib/products/service'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'

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
      data?: { estoqueAtual?: number }
      estoqueAtual?: number
    }>({
      method: 'GET',
      path: `/produtos/${current.product.blingId}/estoque`,
    })

    const remoteStock = Number(data?.data?.estoqueAtual ?? data?.estoqueAtual ?? 0) || 0

    const localRes = await listStockMovements(productId)
    let localBalance = 0
    if (localRes.ok && 'items' in localRes) {
      for (const row of localRes.items) {
        const q = Number(row.quantity) || 0
        if (row.type === 'entry') localBalance += q
        else if (row.type === 'exit' || row.type === 'loss') localBalance -= q
      }
    }

    const diff = remoteStock - localBalance
    if (diff !== 0) {
      await addStockMovement(productId, {
        type: diff > 0 ? 'entry' : 'exit',
        quantity: Math.abs(diff),
        unitValueCents: current.product.costPriceCents ?? current.product.salePriceCents ?? 0,
        source: 'bling',
      })
    }

    return NextResponse.json({ ok: true, adjustedBy: diff })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
  }
}

