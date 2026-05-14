import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { buildParentNameByBlingIdFromPageItems, mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'
import { allocateCatalogSortKeyForInsert } from '@/lib/products/catalog-sort-key'

type LookupMode = 'sku' | 'barcode'
type BlingListResponse = {
  data?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
  itens?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
}

function normalizeSku (value: string) {
  return String(value || '').trim().toLowerCase()
}

function normalizeBarcode (value: string) {
  return String(value || '').replace(/\D/g, '').trim()
}

function getCurrentStock (rows: Array<{ type: string; quantity: number }> | null | undefined): number {
  if (!rows || !Array.isArray(rows)) return 0
  let balance = 0
  for (const row of rows) {
    const type = String(row.type || '').toLowerCase()
    const qty = Number(row.quantity) || 0
    if (type === 'entry') balance += qty
    else if (type === 'exit' || type === 'loss') balance -= qty
  }
  return balance
}

function pickMatch (
  items: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>,
  mode: LookupMode,
  query: string,
): { dto: Record<string, unknown>; local: ReturnType<typeof mapBlingProductToLocal> } | null {
  const normalizedQuery = mode === 'sku' ? normalizeSku(query) : normalizeBarcode(query)
  const parentNames = buildParentNameByBlingIdFromPageItems(items)
  const mapCtx = { parentNameByBlingId: parentNames }
  for (const raw of items) {
    const dto = (raw as { produto?: Record<string, unknown> })?.produto ?? (raw as Record<string, unknown>)
    const local = mapBlingProductToLocal(dto, null, mapCtx)
    const candidate = mode === 'sku'
      ? normalizeSku(local.sku || '')
      : normalizeBarcode(local.barcode || '')
    if (candidate && candidate === normalizedQuery) {
      return { dto, local }
    }
  }
  return null
}

async function findBlingProductByLookup (
  client: { request: <T = unknown>(options: { method?: 'GET'; path: string; query?: Record<string, string | number> }) => Promise<T> },
  mode: LookupMode,
  query: string,
) {
  for (let page = 1; page <= 10; page++) {
    const data = await client.request<BlingListResponse>({
      method: 'GET',
      path: '/produtos',
      query: {
        pagina: page,
        tamanhoPagina: 100,
      },
    })
    const items = data?.data ?? data?.itens ?? []
    if (!Array.isArray(items) || items.length === 0) {
      return null
    }
    const found = pickMatch(items, mode, query)
    if (found) return found
    if (items.length < 100) break
  }
  return null
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { query?: string; mode?: LookupMode } | null
  const query = String(body?.query || '').trim()
  const mode = body?.mode === 'barcode' ? 'barcode' : 'sku'

  if (!query) {
    return NextResponse.json({ ok: false, error: 'query_required' }, { status: 400 })
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  try {
    const found = await findBlingProductByLookup(clientRes.client, mode, query)
    if (!found) {
      return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
    }

    const local = found.local
    const blingId = String(local.blingId || '').trim()
    if (!blingId || !String(local.name || '').trim()) {
      return NextResponse.json({ ok: false, error: 'bling_payload_invalid' }, { status: 422 })
    }

    const estoqueAtual = typeof local.estoqueAtual === 'number' && local.estoqueAtual >= 0
      ? local.estoqueAtual
      : 0
    const unitCents =
      local.costPriceCents != null && local.costPriceCents > 0
        ? local.costPriceCents
        : (local.salePriceCents ?? 0)

    const payload = {
      organization_id: auth.organizationId,
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
      created_by: auth.userId,
    }

    const { data: existing } = await auth.supabase
      .from('products')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('bling_id', blingId)
      .maybeSingle()

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = {
        parent_bling_id: payload.parent_bling_id,
        name: payload.name,
        sku: payload.sku,
        barcode: payload.barcode,
        description: payload.description,
        image_url: payload.image_url,
        sale_price_cents: payload.sale_price_cents,
        cost_price_cents: payload.cost_price_cents,
        is_active: payload.is_active,
        kind: payload.kind,
        bling_sync_pending: false,
        bling_sync_snapshot: payload.bling_sync_snapshot,
        updated_at: new Date().toISOString(),
      }

      const { error: updateErr } = await auth.supabase
        .from('products')
        .update(updatePayload)
        .eq('id', existing.id)
      if (updateErr) {
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      const { data: movements } = await auth.supabase
        .from('product_stock_movements')
        .select('type, quantity')
        .eq('product_id', existing.id)
      const currentStock = getCurrentStock((movements || []) as Array<{ type: string; quantity: number }>)
      const diff = estoqueAtual - currentStock
      if (diff !== 0) {
        await auth.supabase
          .from('product_stock_movements')
          .insert({
            organization_id: auth.organizationId,
            product_id: existing.id,
            type: diff > 0 ? 'entry' : 'exit',
            quantity: Math.abs(diff),
            unit_value_cents: unitCents,
            total_value_cents: Math.abs(diff) * unitCents,
            source: 'bling',
            external_reference: `hub:search-sync:${mode}:${query}`,
            created_by: auth.userId,
          })
      }

      return NextResponse.json({ ok: true, action: 'updated', productId: existing.id, productName: local.name })
    }

    const catalogSortKey = await allocateCatalogSortKeyForInsert(auth.supabase, {
      parentBlingId: payload.parent_bling_id,
    })
    const { data: inserted, error: insertErr } = await auth.supabase
      .from('products')
      .insert({ ...payload, catalog_sort_key: catalogSortKey })
      .select('id')
      .single()
    if (insertErr || !inserted?.id) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    if (estoqueAtual > 0) {
      await auth.supabase
        .from('product_stock_movements')
        .insert({
          organization_id: auth.organizationId,
          product_id: inserted.id,
          type: 'entry',
          quantity: estoqueAtual,
          unit_value_cents: unitCents,
          total_value_cents: estoqueAtual * unitCents,
          source: 'bling',
          external_reference: `hub:search-sync:${mode}:${query}`,
          created_by: auth.userId,
        })
    }

    return NextResponse.json({ ok: true, action: 'created', productId: inserted.id, productName: local.name })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
  }
}

