import { NextResponse } from 'next/server'
import { getPortalAuth, createSupabaseServerClient } from '@/lib/supabase/server'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { updateProduct } from '@/lib/products/service'

export const maxDuration = 60

export async function POST (request: Request) {
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    limit?: number
    offset?: number
  }
  const pageSize = Math.min(Math.max(Number(body.limit) || 50, 1), 200)
  const offset = Math.max(Number(body.offset) || 0, 0)

  const supabase = await createSupabaseServerClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, bling_id')
    .not('bling_id', 'is', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!products || products.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, offset, finished: true })
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  let processed = 0
  let updated = 0
  const failures: Array<{ productId: string; blingId: string; error: string }> = []

  for (const row of products as Array<{ id: string; bling_id: string }>) {
    const blingId = row.bling_id
    if (!blingId) continue

    try {
      const data = await clientRes.client.request<{
        data?: Record<string, unknown>
      } | Record<string, unknown>>({
        method: 'GET',
        path: `/produtos/${blingId}`,
      })

      const dto = data?.data ?? data ?? {}
      const local = mapBlingProductToLocal(dto)

      const result = await updateProduct(row.id, {
        name: local.name,
        sku: local.sku ?? undefined,
        barcode: local.barcode ?? undefined,
        description: local.description ?? undefined,
        salePriceCents: local.salePriceCents ?? undefined,
        costPriceCents: local.costPriceCents ?? undefined,
        isActive: local.isActive ?? undefined,
        blingId: local.blingId ?? undefined,
        kind: local.kind ?? undefined,
      })

      if (result.ok) {
        updated += 1
      } else {
        failures.push({
          productId: row.id,
          blingId,
          error: 'error' in result ? result.error : 'update_failed',
        })
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      failures.push({
        productId: row.id,
        blingId,
        error: message,
      })
    } finally {
      processed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    updated,
    offset,
    nextOffset: offset + processed,
    finished: processed < pageSize,
    failures,
  })
}

