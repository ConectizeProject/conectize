import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { blingProdutoApiPath, getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { buildParentNameByBlingIdFromPageItems, mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'
import { allocateCatalogSortKeyForInsert } from '@/lib/products/catalog-sort-key'

type BlingRequestClient = {
  request: <T = unknown>(options: {
    method?: 'GET'
    path: string
    query?: Record<string, string | number | string[] | number[]>
  }) => Promise<T>
}

type BlingListResponse = {
  data?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
  itens?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
}

type MappedLocal = ReturnType<typeof mapBlingProductToLocal>

type SyncResultRow = {
  sku: string
  action: 'created' | 'updated' | 'not_found' | 'invalid'
  productId?: string
  productName?: string
}

function normalizeSku (value: string) {
  return String(value || '').trim().toLowerCase()
}

/** Compara GTINs ignorando espaços e caracteres não numéricos. */
function normalizeGtin (value: string) {
  return String(value || '').replace(/\D/g, '')
}

function parseUniqueTokens (
  values: unknown[],
  normalize: (value: string) => string,
  max = 50,
): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const raw of values) {
    const token = String(raw ?? '').trim()
    const key = normalize(token)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(token)
    if (unique.length >= max) break
  }
  return unique
}

function parseSkusFromBody (body: { skus?: unknown; query?: unknown } | null): string[] {
  const fromArray = Array.isArray(body?.skus)
    ? body.skus.map((item) => String(item ?? '').trim()).filter(Boolean)
    : []
  const fromQuery = String(body?.query ?? '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return parseUniqueTokens([...fromArray, ...fromQuery], normalizeSku)
}

function parseGtinsFromBody (body: { gtins?: unknown; gtin?: unknown } | null): string[] {
  const fromArray = Array.isArray(body?.gtins)
    ? body.gtins.map((item) => String(item ?? '').trim()).filter(Boolean)
    : []
  const fromSingle = String(body?.gtin ?? '').trim()
  const merged = fromSingle ? [...fromArray, fromSingle] : fromArray
  return parseUniqueTokens(merged, normalizeGtin)
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

function extractListDto (
  raw: { produto?: Record<string, unknown> } | Record<string, unknown>,
): Record<string, unknown> {
  return (raw as { produto?: Record<string, unknown> })?.produto ?? (raw as Record<string, unknown>)
}

/**
 * A listagem GET /produtos omite campos detalhados (ex.: gtin / codigoBarras).
 * Buscamos GET /produtos/{id} para gravar barcode e demais dados completos.
 */
async function enrichListItemsWithDetails (
  client: BlingRequestClient,
  items: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>,
): Promise<Array<{ dto: Record<string, unknown>; local: MappedLocal }>> {
  const parentNames = buildParentNameByBlingIdFromPageItems(items)
  const mapCtx = { parentNameByBlingId: parentNames }
  const enriched: Array<{ dto: Record<string, unknown>; local: MappedLocal }> = []

  for (const raw of items) {
    const listDto = extractListDto(raw)
    const blingId = listDto.id != null ? String(listDto.id).trim() : ''
    let dto = listDto

    if (blingId) {
      try {
        const detail = await client.request<{ data?: Record<string, unknown> } | Record<string, unknown>>({
          method: 'GET',
          path: blingProdutoApiPath(blingId),
        })
        const detailData =
          detail && typeof detail === 'object' && 'data' in detail && detail.data
            ? (detail.data as Record<string, unknown>)
            : (detail as Record<string, unknown>)
        if (detailData && typeof detailData === 'object') {
          dto = detailData
        }
      } catch {
        // mantém payload da listagem se o detalhe falhar
      }
    }

    enriched.push({
      dto,
      local: mapBlingProductToLocal(dto, blingId || null, mapCtx),
    })
  }

  return enriched
}

async function findBlingProductsBySkus (
  client: BlingRequestClient,
  skus: string[],
) {
  const query: Record<string, string | number | string[]> = {
    pagina: 1,
    limite: Math.min(100, Math.max(50, skus.length)),
    criterio: 5,
  }
  if (skus.length === 1) {
    query.codigo = skus[0]
  } else {
    query.codigos = skus
  }

  const data = await client.request<BlingListResponse>({
    method: 'GET',
    path: '/produtos',
    query,
  })
  const items = data?.data ?? data?.itens ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }
  return enrichListItemsWithDetails(client, items)
}

async function findBlingProductsByGtins (
  client: BlingRequestClient,
  gtins: string[],
) {
  const data = await client.request<BlingListResponse>({
    method: 'GET',
    path: '/produtos',
    query: {
      pagina: 1,
      limite: Math.min(100, Math.max(50, gtins.length)),
      criterio: 5,
      gtins,
    },
  })
  const items = data?.data ?? data?.itens ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }
  return enrichListItemsWithDetails(client, items)
}

function collectGtinKeys (local: MappedLocal, dto: Record<string, unknown>): string[] {
  const keys = new Set<string>()
  for (const value of [local.barcode, dto.gtin, dto.gtinEmbalagem, dto.codigoBarras]) {
    const key = normalizeGtin(String(value ?? ''))
    if (key) keys.add(key)
  }
  return [...keys]
}

function describeLookupFilter (skus: string[], gtins: string[]): string {
  const parts: string[] = []
  if (skus.length === 1) parts.push('codigo')
  else if (skus.length > 1) parts.push('codigos')
  if (gtins.length > 0) parts.push('gtins')
  return parts.join('+') || 'none'
}

/** criterio=1 = últimos incluídos (Bling). */
async function findBlingLatestCreatedProducts (
  client: BlingRequestClient,
  limit = 50,
) {
  const data = await client.request<BlingListResponse>({
    method: 'GET',
    path: '/produtos',
    query: {
      pagina: 1,
      limite: Math.min(100, Math.max(1, limit)),
      criterio: 1,
    },
  })
  const items = data?.data ?? data?.itens ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return []
  }
  return enrichListItemsWithDetails(client, items)
}

async function upsertSyncedProduct (params: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  local: MappedLocal
  skuQuery: string
}): Promise<SyncResultRow> {
  const { supabase, organizationId, userId, local, skuQuery } = params
  const blingId = String(local.blingId || '').trim()
  if (!blingId || !String(local.name || '').trim()) {
    return { sku: skuQuery, action: 'invalid' }
  }

  const estoqueAtual = typeof local.estoqueAtual === 'number' && local.estoqueAtual >= 0
    ? local.estoqueAtual
    : 0
  const unitCents =
    local.costPriceCents != null && local.costPriceCents > 0
      ? local.costPriceCents
      : (local.salePriceCents ?? 0)

  const payload = {
    organization_id: organizationId,
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
    created_by: userId,
  }

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
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

    const { error: updateErr } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', existing.id)
    if (updateErr) {
      throw new Error('db_error')
    }

    const { data: movements } = await supabase
      .from('product_stock_movements')
      .select('type, quantity')
      .eq('product_id', existing.id)
    const currentStock = getCurrentStock((movements || []) as Array<{ type: string; quantity: number }>)
    const diff = estoqueAtual - currentStock
    if (diff !== 0) {
      await supabase
        .from('product_stock_movements')
        .insert({
          organization_id: organizationId,
          product_id: existing.id,
          type: diff > 0 ? 'entry' : 'exit',
          quantity: Math.abs(diff),
          unit_value_cents: unitCents,
          total_value_cents: Math.abs(diff) * unitCents,
          source: 'bling',
          external_reference: `hub:search-sync:sku:${skuQuery}`,
          created_by: userId,
        })
    }

    return {
      sku: skuQuery,
      action: 'updated',
      productId: existing.id,
      productName: local.name,
    }
  }

  const catalogSortKey = await allocateCatalogSortKeyForInsert(supabase, {
    parentBlingId: payload.parent_bling_id,
  })
  const { data: inserted, error: insertErr } = await supabase
    .from('products')
    .insert({ ...payload, catalog_sort_key: catalogSortKey })
    .select('id')
    .single()
  if (insertErr || !inserted?.id) {
    throw new Error('db_error')
  }

  if (estoqueAtual > 0) {
    await supabase
      .from('product_stock_movements')
      .insert({
        organization_id: organizationId,
        product_id: inserted.id,
        type: 'entry',
        quantity: estoqueAtual,
        unit_value_cents: unitCents,
        total_value_cents: estoqueAtual * unitCents,
        source: 'bling',
        external_reference: `hub:search-sync:sku:${skuQuery}`,
        created_by: userId,
      })
  }

  return {
    sku: skuQuery,
    action: 'created',
    productId: inserted.id,
    productName: local.name,
  }
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as {
    skus?: unknown
    query?: unknown
    gtins?: unknown
    gtin?: unknown
    mode?: unknown
    limit?: unknown
  } | null
  const mode = body?.mode === 'latest' ? 'latest' : 'lookup'
  const skus = mode === 'lookup' ? parseSkusFromBody(body) : []
  const gtins = mode === 'lookup' ? parseGtinsFromBody(body) : []
  const latestLimitRaw = Number(body?.limit)
  const latestLimit = Number.isFinite(latestLimitRaw) && latestLimitRaw > 0
    ? Math.min(100, Math.floor(latestLimitRaw))
    : 50

  if (mode === 'lookup' && skus.length === 0 && gtins.length === 0) {
    return NextResponse.json({ ok: false, error: 'query_required' }, { status: 400 })
  }

  const clientRes = await getBlingClientForCurrentUser()
  if (!clientRes.ok || !('client' in clientRes)) {
    const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  try {
    const results: SyncResultRow[] = []
    const upsertedBlingIds = new Set<string>()

    if (mode === 'latest') {
      const foundItems = await findBlingLatestCreatedProducts(clientRes.client, latestLimit)
      if (foundItems.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'product_not_found',
          results: [],
          created: 0,
          updated: 0,
          notFound: 0,
          filter: 'criterio:1',
        }, { status: 404 })
      }

      for (const item of foundItems) {
        const blingId = String(item.local.blingId || '').trim()
        if (blingId) {
          if (upsertedBlingIds.has(blingId)) continue
          upsertedBlingIds.add(blingId)
        }
        const skuLabel = String(item.local.sku || item.local.name || blingId || 'sem-sku').trim()
        results.push(
          await upsertSyncedProduct({
            supabase: auth.supabase,
            organizationId: auth.organizationId,
            userId: auth.userId,
            local: item.local,
            skuQuery: skuLabel,
          }),
        )
      }
    } else {
      if (skus.length > 0) {
        const foundItems = await findBlingProductsBySkus(clientRes.client, skus)
        const bySku = new Map<string, { dto: Record<string, unknown>; local: MappedLocal }>()
        for (const item of foundItems) {
          const key = normalizeSku(item.local.sku || '')
          if (key && !bySku.has(key)) bySku.set(key, item)
        }

        for (const sku of skus) {
          const match = bySku.get(normalizeSku(sku))
          if (!match) {
            results.push({ sku, action: 'not_found' })
            continue
          }
          const blingId = String(match.local.blingId || '').trim()
          if (blingId && upsertedBlingIds.has(blingId)) continue
          if (blingId) upsertedBlingIds.add(blingId)
          results.push(
            await upsertSyncedProduct({
              supabase: auth.supabase,
              organizationId: auth.organizationId,
              userId: auth.userId,
              local: match.local,
              skuQuery: sku,
            }),
          )
        }
      }

      if (gtins.length > 0) {
        const foundItems = await findBlingProductsByGtins(clientRes.client, gtins)
        const byGtin = new Map<string, { dto: Record<string, unknown>; local: MappedLocal }>()
        for (const item of foundItems) {
          for (const key of collectGtinKeys(item.local, item.dto)) {
            if (!byGtin.has(key)) byGtin.set(key, item)
          }
        }

        for (const gtin of gtins) {
          const match = byGtin.get(normalizeGtin(gtin))
          if (!match) {
            results.push({ sku: gtin, action: 'not_found' })
            continue
          }
          const blingId = String(match.local.blingId || '').trim()
          if (blingId && upsertedBlingIds.has(blingId)) continue
          if (blingId) upsertedBlingIds.add(blingId)
          results.push(
            await upsertSyncedProduct({
              supabase: auth.supabase,
              organizationId: auth.organizationId,
              userId: auth.userId,
              local: match.local,
              skuQuery: gtin,
            }),
          )
        }
      }
    }

    const created = results.filter((r) => r.action === 'created').length
    const updated = results.filter((r) => r.action === 'updated').length
    const notFound = results.filter((r) => r.action === 'not_found').length
    const invalid = results.filter((r) => r.action === 'invalid').length
    const synced = created + updated
    const filter = mode === 'latest' ? 'criterio:1' : describeLookupFilter(skus, gtins)
    const lookupCount = skus.length + gtins.length

    if (synced === 0) {
      return NextResponse.json({
        ok: false,
        error: 'product_not_found',
        results,
        created,
        updated,
        notFound,
        invalid,
        filter,
      }, { status: 404 })
    }

    const firstOk = results.find((r) => r.action === 'created' || r.action === 'updated')
    return NextResponse.json({
      ok: true,
      action: mode === 'latest'
        ? 'latest'
        : (lookupCount === 1 ? firstOk?.action : 'batch'),
      productId: firstOk?.productId,
      productName: firstOk?.productName,
      results,
      created,
      updated,
      notFound,
      invalid,
      fetched: results.length,
      filter,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    if (message === 'db_error') {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
  }
}
