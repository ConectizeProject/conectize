import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { buildParentNameByBlingIdFromPageItems, mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'
import { allocateCatalogSortKeyForInsert } from '@/lib/products/catalog-sort-key'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>
type BlingProductsListResponse = {
  data?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
  itens?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
}

async function getCurrentStock (supabase: SupabaseClient, productId: string): Promise<number> {
  const { data } = await supabase
    .from('product_stock_movements')
    .select('type, quantity')
    .eq('product_id', productId)
  if (!data || !Array.isArray(data)) return 0
  let balance = 0
  for (const row of data) {
    const type = String((row as { type: string }).type ?? '').toLowerCase()
    const qty = Number((row as { quantity: number }).quantity) || 0
    if (type === 'entry') balance += qty
    else if (type === 'exit' || type === 'loss') balance -= qty
  }
  return balance
}

function insertStockFromBling (
  supabase: SupabaseClient,
  productId: string,
  quantity: number,
  unitCents: number,
  userId: string,
  ref: string,
) {
  return supabase
    .from('product_stock_movements')
    .insert({
      product_id: productId,
      type: quantity >= 0 ? 'entry' : 'exit',
      quantity: Math.abs(quantity),
      unit_value_cents: unitCents,
      total_value_cents: Math.abs(quantity) * unitCents,
      source: 'bling',
      external_reference: ref,
      created_by: userId,
    })
}

export async function POST (request: Request) {
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { page?: number; limit?: number }
  const page = Number(body.page || 1)
  const limit = Math.min(Number(body.limit || 50), 100)

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }
  const { client } = clientRes

  try {
    const data = await client.request<BlingProductsListResponse>({
      method: 'GET',
      path: '/produtos',
      query: { pagina: page, tamanhoPagina: limit },
    })

    const items = data?.data ?? data?.itens ?? []
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, updated: 0 })
    }

    const supabase = await createSupabaseServerClient()
    let imported = 0
    let updated = 0

    const parentNames = buildParentNameByBlingIdFromPageItems(items)
    const mapCtx = { parentNameByBlingId: parentNames }

    for (const raw of items) {
      const dto = raw?.produto ?? raw

      const local = mapBlingProductToLocal(dto, null, mapCtx)
      if (!local.name) continue
      const blingId = local.blingId
      if (!blingId) continue

      const estoqueAtual = typeof local.estoqueAtual === 'number' && local.estoqueAtual >= 0 ? local.estoqueAtual : 0
      /** CMV: custo real; se zero no Bling, usa preço de venda como valor unitário da entrada (evita confundir com listagem). */
      const unitCents =
        local.costPriceCents != null && local.costPriceCents > 0
          ? local.costPriceCents
          : (local.salePriceCents ?? 0)

      const payload = {
        bling_id: blingId,
        bling_sync_pending: false,
        bling_sync_snapshot: createProductSyncSnapshot(local),
        parent_bling_id: local.parentBlingId ?? null,
        name: local.name,
        sku: local.sku,
        barcode: local.barcode,
        description: local.description,
        image_url: local.imageUrl ?? null,
        sale_price_cents: local.salePriceCents,
        cost_price_cents: local.costPriceCents,
        is_active: local.isActive ?? true,
        kind: local.kind ?? null,
        created_by: user.id,
      }

      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('bling_id', blingId)
        .eq('created_by', user.id)
        .maybeSingle()

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          bling_id: payload.bling_id,
          bling_sync_pending: payload.bling_sync_pending,
          parent_bling_id: payload.parent_bling_id,
          name: payload.name,
          sku: payload.sku,
          description: payload.description,
          image_url: payload.image_url,
          sale_price_cents: payload.sale_price_cents,
          cost_price_cents: payload.cost_price_cents,
          is_active: payload.is_active,
          kind: payload.kind,
          updated_at: new Date().toISOString(),
        }
        if (payload.barcode !== undefined && payload.barcode !== null) {
          updatePayload.barcode = payload.barcode
        }
        const { error } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', existing.id)

        if (!error) {
          updated += 1
          const currentStock = await getCurrentStock(supabase, existing.id)
          const diff = estoqueAtual - currentStock
          if (diff !== 0) {
            await insertStockFromBling(supabase, existing.id, diff, unitCents, user.id, 'import')
          }
        }
      } else {
        const catalogSortKey = await allocateCatalogSortKeyForInsert(supabase, {
          parentBlingId: payload.parent_bling_id,
        })
        const { data: inserted, error } = await supabase
          .from('products')
          .insert({ ...payload, catalog_sort_key: catalogSortKey })
          .select('id')
          .single()

        if (!error && inserted?.id) {
          imported += 1
          if (estoqueAtual > 0) {
            await insertStockFromBling(supabase, inserted.id, estoqueAtual, unitCents, user.id, 'import')
          }
        }
      }
    }

    return NextResponse.json({ ok: true, imported, updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
  }
}

