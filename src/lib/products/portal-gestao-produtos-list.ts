import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveSearchTokens, sanitizeIlikeToken } from '@/lib/products/product-search'
import {
  compareFlatCatalogSort,
  expandSearchVisibleProductIds,
  fetchIdSortRowsInChunks,
  fetchProductsByIdsOrdered,
  type IdSortRow,
} from '@/lib/products/produtos-flat-list'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'
import type { ProductRow } from '@/app/(portal)/portal/produtos/product-list-shared'

export const GESTAO_LIST_CHUNK = 20
export const GESTAO_LIST_MAX_LOADED = 2000

export const GESTAO_PRODUCT_LIST_SELECT =
  'id, bling_id, bling_sync_pending, kind, name, sku, barcode, image_url, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, is_active, created_at, catalog_sort_key, parent_bling_id'

export type GestaoListRawRow = {
  id: string
  bling_id?: string | null
  parent_bling_id?: string | null
  bling_sync_pending?: boolean | null
  kind?: 'product' | 'service' | null
  name: string
  sku?: string | null
  barcode?: string | null
  image_url?: string | null
  sale_price_cents?: number | null
  cost_price_cents?: number | null
  cost_price_manual_edited_at?: string | null
  is_active?: boolean
  created_at?: string
  catalog_sort_key?: string | null
}

type MovementRow = {
  product_id: string
  type: string
  quantity: number
  unit_value_cents?: number
  created_at?: string
}

export function parseGestaoLoadedParam (raw: string | undefined): number {
  const n = Math.floor(Number(String(raw || '').trim()) || 0)
  if (!Number.isFinite(n) || n < GESTAO_LIST_CHUNK) return GESTAO_LIST_CHUNK
  return Math.min(n, GESTAO_LIST_MAX_LOADED)
}

export function buildProdutosGestaoHref (opts: {
  q: string
  kind: 'product' | 'service' | 'all'
  loaded?: number
  sku?: string
  barcode?: string
}): string {
  const params = new URLSearchParams()
  params.set('tab', 'gestao')
  const trimmed = opts.q.trim()
  if (trimmed) params.set('q', trimmed)
  if (opts.kind === 'service') params.set('kind', 'service')
  else if (opts.kind === 'product') params.set('kind', 'product')
  const loaded = opts.loaded ?? GESTAO_LIST_CHUNK
  if (loaded > GESTAO_LIST_CHUNK) params.set('loaded', String(loaded))
  const skuT = String(opts.sku || '').trim()
  if (skuT) params.set('sku', skuT)
  const bcT = String(opts.barcode || '').trim()
  if (bcT) params.set('barcode', bcT)
  return `/portal/produtos?${params.toString()}`
}

export type FetchGestaoListSliceResult = {
  flatRows: GestaoListRawRow[]
  totalCount: number
  listLoadError: boolean
  hasSearchButNoValidTokens: boolean
}

function normalizeGestaoSkuBarcodeFilter (raw: string | undefined): string {
  return sanitizeIlikeToken(String(raw || '').trim())
}

async function filterSortRowsBySkuBarcode (
  supabase: SupabaseClient,
  sortRows: IdSortRow[],
  skuTrim: string,
  barcodeTrim: string,
): Promise<IdSortRow[]> {
  if (!skuTrim && !barcodeTrim) return sortRows
  const CHUNK = 80
  const allowed = new Set<string>()
  const ids = sortRows.map((r) => r.id)
  const skuLower = skuTrim.toLowerCase()
  const bcLower = barcodeTrim.toLowerCase()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data } = await supabase.from('products').select('id, sku, barcode').in('id', chunk)
    for (const raw of data ?? []) {
      const row = raw as { id?: string; sku?: string | null; barcode?: string | null }
      const id = String(row.id || '')
      if (!id) continue
      const skuVal = String(row.sku || '').toLowerCase()
      const bcVal = String(row.barcode || '').toLowerCase()
      if (skuTrim && !skuVal.includes(skuLower)) continue
      if (barcodeTrim && !bcVal.includes(bcLower)) continue
      allowed.add(id)
    }
  }
  return sortRows.filter((r) => allowed.has(r.id))
}

async function filterSortRowsExcludeServices (
  supabase: SupabaseClient,
  sortRows: IdSortRow[],
): Promise<IdSortRow[]> {
  const CHUNK = 80
  const keep = new Set<string>()
  const ids = sortRows.map((r) => r.id)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data } = await supabase.from('products').select('id, kind').in('id', chunk)
    for (const raw of data ?? []) {
      const row = raw as { id?: string; kind?: string | null }
      const id = String(row.id || '')
      if (!id) continue
      if (row.kind === 'service') continue
      keep.add(id)
    }
  }
  return sortRows.filter((r) => keep.has(r.id))
}

/**
 * Lista uma fatia do catálogo (gestão staff) com a mesma ordenação e filtros da página.
 * `offset` + `limit` para SSR acumulado usar offset=0 e limit=loaded.
 */
export async function fetchGestaoListRawSlice (
  supabase: SupabaseClient,
  options: {
    query: string
    kindFilter: 'product' | 'service' | 'all'
    offset: number
    limit: number
    sku?: string
    barcode?: string
  },
): Promise<FetchGestaoListSliceResult> {
  const { query, kindFilter, offset, limit } = options
  const skuTrim = normalizeGestaoSkuBarcodeFilter(options.sku)
  const barcodeTrim = normalizeGestaoSkuBarcodeFilter(options.barcode)
  const searchTokens = effectiveSearchTokens(query)
  const hasSearchButNoValidTokens = Boolean(query.trim()) && searchTokens.length === 0

  let flatRows: GestaoListRawRow[] = []
  let totalCount = 0
  let listLoadError = false

  if (hasSearchButNoValidTokens) {
    flatRows = []
    totalCount = 0
  } else if (searchTokens.length > 0 && (kindFilter === 'product' || kindFilter === 'all')) {
    const visibleIds = await expandSearchVisibleProductIds(supabase, searchTokens)
    if (visibleIds.size === 0) {
      flatRows = []
      totalCount = 0
    } else {
      let sortRows = await fetchIdSortRowsInChunks(supabase, [...visibleIds])
      sortRows.sort(compareFlatCatalogSort)
      if (skuTrim || barcodeTrim) {
        sortRows = await filterSortRowsBySkuBarcode(supabase, sortRows, skuTrim, barcodeTrim)
      }
      if (kindFilter === 'product') {
        sortRows = await filterSortRowsExcludeServices(supabase, sortRows)
      }
      totalCount = sortRows.length
      const pageSlice = sortRows.slice(offset, offset + limit)
      const orderedIds = pageSlice.map((r) => r.id)
      const full = await fetchProductsByIdsOrdered(supabase, orderedIds, GESTAO_PRODUCT_LIST_SELECT)
      flatRows = full as GestaoListRawRow[]
    }
  } else if (searchTokens.length > 0 && kindFilter === 'service') {
    let serviceQuery = supabase
      .from('products')
      .select(GESTAO_PRODUCT_LIST_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .eq('kind', 'service')
      .order('catalog_sort_key', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    for (const token of searchTokens) {
      serviceQuery = serviceQuery.or(
        `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
      )
    }
    if (skuTrim) {
      serviceQuery = serviceQuery.ilike('sku', `%${skuTrim}%`)
    }
    if (barcodeTrim) {
      serviceQuery = serviceQuery.ilike('barcode', `%${barcodeTrim}%`)
    }

    const { data, count, error } = await serviceQuery
    if (error) {
      console.error('[servicos-flat-list]', error)
      listLoadError = true
      flatRows = []
      totalCount = 0
    } else {
      flatRows = (data ?? []) as GestaoListRawRow[]
      totalCount = typeof count === 'number' ? count : flatRows.length
    }
  } else {
    let queryBuilder = supabase
      .from('products')
      .select(GESTAO_PRODUCT_LIST_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .order('catalog_sort_key', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (kindFilter === 'service') {
      queryBuilder = queryBuilder.eq('kind', 'service')
    } else if (kindFilter === 'product') {
      queryBuilder = queryBuilder.neq('kind', 'service')
    }
    if (skuTrim) {
      queryBuilder = queryBuilder.ilike('sku', `%${skuTrim}%`)
    }
    if (barcodeTrim) {
      queryBuilder = queryBuilder.ilike('barcode', `%${barcodeTrim}%`)
    }

    const { data, count, error } = await queryBuilder

    if (error) {
      console.error('[produtos-flat-list]', error)
      listLoadError = true
      flatRows = []
      totalCount = 0
    } else {
      flatRows = (data ?? []) as GestaoListRawRow[]
      totalCount = typeof count === 'number' ? count : flatRows.length
    }
  }

  return { flatRows, totalCount, listLoadError, hasSearchButNoValidTokens }
}

export async function enrichGestaoRawRowsToProductRows (
  supabase: SupabaseClient,
  flatRows: GestaoListRawRow[],
): Promise<ProductRow[]> {
  const parentBlingKeysOnPage = new Set<string>()
  for (const p of flatRows) {
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    if (pb) parentBlingKeysOnPage.add(pb)
  }

  const parentNameByBling = new Map<string, string>()
  if (parentBlingKeysOnPage.size > 0) {
    const keys = [...parentBlingKeysOnPage]
    const CHUNK = 80
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK)
      const { data: parents } = await supabase
        .from('products')
        .select('bling_id, name')
        .is('parent_bling_id', null)
        .in('bling_id', chunk)

      for (const row of parents ?? []) {
        const r = row as { bling_id?: string; name?: string }
        if (r.bling_id != null) {
          parentNameByBling.set(String(r.bling_id).trim(), String(r.name || '').trim())
        }
      }
    }
  }

  const stockByProductId: Record<string, number> = {}
  const lastEntryCostByProductId: Record<string, number> = {}
  const lastEntryDateByProductId: Record<string, number> = {}
  const hasStockMovementsByProductId: Record<string, boolean> = {}

  if (flatRows.length > 0) {
    const ids = flatRows.map((p) => p.id)

    type StockSummaryRpcRow = {
      product_id: string
      current_stock: number | string
      has_movements: boolean
      last_entry_unit_value_cents: number | null
      last_entry_created_at: string | null
    }

    const { data: stockRpcRows, error: stockRpcError } = await supabase.rpc(
      'portal_products_list_stock_summary',
      { p_product_ids: ids },
    )

    if (!stockRpcError && stockRpcRows && Array.isArray(stockRpcRows)) {
      for (const row of stockRpcRows as StockSummaryRpcRow[]) {
        const pid = String(row.product_id)
        const raw = row.current_stock
        const n = typeof raw === 'number' ? raw : Number(raw)
        stockByProductId[pid] = Number.isFinite(n) ? n : 0
        hasStockMovementsByProductId[pid] = Boolean(row.has_movements)
        const cents = row.last_entry_unit_value_cents
        const createdAt = row.last_entry_created_at
        if (cents != null && createdAt) {
          lastEntryCostByProductId[pid] = Number(cents)
          lastEntryDateByProductId[pid] = new Date(createdAt).getTime()
        }
      }
    } else {
      const { data: movements, error: movementsError } = await supabase
        .from('product_stock_movements')
        .select('product_id, type, quantity, unit_value_cents, created_at')
        .in('product_id', ids)
        .limit(5000)

      if (!movementsError && movements && Array.isArray(movements)) {
        for (const m of movements as MovementRow[]) {
          const pid = m.product_id
          const type = String(m.type ?? '').toLowerCase()
          const qty = Number(m.quantity) || 0
          const valueCents = Number(m.unit_value_cents) || 0
          const createdAt = m.created_at

          hasStockMovementsByProductId[pid] = true

          if (!stockByProductId[pid]) stockByProductId[pid] = 0
          if (type === 'entry') stockByProductId[pid] += qty
          else if (type === 'exit' || type === 'loss') stockByProductId[pid] -= qty

          if (type === 'entry' && valueCents > 0 && createdAt) {
            const currentDate = new Date(createdAt).getTime()
            const existingDate = lastEntryDateByProductId[pid] ?? 0

            if (!lastEntryCostByProductId[pid] || currentDate >= existingDate) {
              lastEntryCostByProductId[pid] = valueCents
              lastEntryDateByProductId[pid] = currentDate
            }
          }
        }
      }
    }
  }

  const normalize = (p: GestaoListRawRow) => ({
    id: p.id,
    bling_id: p.bling_id ?? null,
    parent_bling_id: p.parent_bling_id ?? null,
    bling_sync_pending: p.bling_sync_pending ?? false,
    kind: p.kind ?? null,
    name: p.name,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    image_url: p.image_url ?? null,
    sale_price_cents: p.sale_price_cents ?? null,
    cost_price_cents: resolveListDisplayCostCents({
      costPriceCents: p.cost_price_cents,
      costPriceManualEditedAt: p.cost_price_manual_edited_at,
      lastEntryUnitValueCents: lastEntryCostByProductId[p.id],
      lastEntryTimeMs: lastEntryDateByProductId[p.id] ?? null,
    }),
    is_active: p.is_active ?? true,
    created_at: p.created_at,
    current_stock: stockByProductId[p.id] ?? 0,
    has_stock_movements: hasStockMovementsByProductId[p.id] ?? false,
  })

  return flatRows.map((p) => {
    const normalized = normalize(p)
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    const isVar = pb.length > 0
    return {
      ...normalized,
      is_variation: isVar,
      parent_name: isVar ? (parentNameByBling.get(pb) || null) : null,
    }
  })
}

export function gestaoListRangeLabel (opts: {
  hasSearchButNoValidTokens: boolean
  totalCount: number
  shownCount: number
}): string {
  const { hasSearchButNoValidTokens, totalCount, shownCount } = opts
  if (hasSearchButNoValidTokens) return 'Nenhum resultado para o termo informado'
  if (totalCount === 0) return '0 resultados'
  const end = Math.min(shownCount, totalCount)
  if (totalCount > end) return `1–${end} de ${totalCount} (deslize para carregar mais)`
  return `${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`
}
