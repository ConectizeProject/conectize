import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveSearchTokens, sanitizeIlikeToken } from '@/lib/products/product-search'
import {
  expandSearchVisibleProductIds,
  fetchActiveProductSortRows,
  fetchIdSortRowsInChunks,
  fetchProductsByIdsOrdered,
  groupProductRowsAsFamilies,
  includeParentsForChildren,
  sliceProductFamilies,
  type IdSortRow,
} from '@/lib/products/produtos-flat-list'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'
import type { ProductRow } from '@/app/(portal)/portal/produtos/product-list-shared'

export const GESTAO_LIST_CHUNK = 20
export const GESTAO_LIST_MAX_LOADED = 2000

export const GESTAO_PRODUCT_LIST_SELECT =
  'id, bling_id, bling_sync_pending, kind, name, sku, barcode, image_url, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, is_active, created_at, catalog_sort_key, parent_bling_id, parent_product_id'

export type GestaoListRawRow = {
  id: string
  bling_id?: string | null
  parent_bling_id?: string | null
  parent_product_id?: string | null
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

function filterSortRowsBySkuBarcode (
  sortRows: IdSortRow[],
  skuTrim: string,
  barcodeTrim: string,
): IdSortRow[] {
  if (!skuTrim && !barcodeTrim) return sortRows
  const skuLower = skuTrim.toLowerCase()
  const bcLower = barcodeTrim.toLowerCase()
  const matched = sortRows.filter((row) => {
    const skuVal = String(row.sku || '').toLowerCase()
    const bcVal = String(row.barcode || '').toLowerCase()
    if (skuTrim && !skuVal.includes(skuLower)) return false
    if (barcodeTrim && !bcVal.includes(bcLower)) return false
    return true
  })
  return includeParentsForChildren(sortRows, matched)
}

function filterSortRowsExcludeServices (sortRows: IdSortRow[]): IdSortRow[] {
  return sortRows.filter((row) => row.kind !== 'service')
}

async function loadGroupedGestaoPage (
  supabase: SupabaseClient,
  sortRows: IdSortRow[],
  offset: number,
  limit: number,
): Promise<{ flatRows: GestaoListRawRow[]; totalCount: number }> {
  const families = groupProductRowsAsFamilies(sortRows)
  const sliced = sliceProductFamilies(families, offset, limit)
  const orderedIds = sliced.rows.map((r) => r.id)
  const full = await fetchProductsByIdsOrdered(supabase, orderedIds, GESTAO_PRODUCT_LIST_SELECT)
  return {
    flatRows: full as GestaoListRawRow[],
    totalCount: sliced.totalCount,
  }
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
    return { flatRows: [], totalCount: 0, listLoadError: false, hasSearchButNoValidTokens }
  }

  try {
    if (searchTokens.length > 0 && kindFilter === 'service') {
      const visibleIds = new Set<string>()
      let matchQuery = supabase
        .from('products')
        .select('id')
        .eq('is_active', true)
        .eq('kind', 'service')
      for (const token of searchTokens) {
        matchQuery = matchQuery.or(
          `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
        )
      }
      const { data: matchRows, error } = await matchQuery
      if (error) throw error
      for (const row of matchRows ?? []) {
        if ((row as { id?: string }).id) visibleIds.add(String((row as { id: string }).id))
      }
      let sortRows = await fetchIdSortRowsInChunks(supabase, [...visibleIds])
      if (skuTrim || barcodeTrim) {
        sortRows = filterSortRowsBySkuBarcode(sortRows, skuTrim, barcodeTrim)
      }
      const page = await loadGroupedGestaoPage(supabase, sortRows, offset, limit)
      flatRows = page.flatRows
      totalCount = page.totalCount
    } else if (searchTokens.length > 0) {
      const visibleIds = await expandSearchVisibleProductIds(supabase, searchTokens)
      if (visibleIds.size === 0) {
        flatRows = []
        totalCount = 0
      } else {
        let sortRows = await fetchIdSortRowsInChunks(supabase, [...visibleIds])
        if (skuTrim || barcodeTrim) {
          sortRows = filterSortRowsBySkuBarcode(sortRows, skuTrim, barcodeTrim)
        }
        if (kindFilter === 'product') {
          sortRows = filterSortRowsExcludeServices(sortRows)
        }
        const page = await loadGroupedGestaoPage(supabase, sortRows, offset, limit)
        flatRows = page.flatRows
        totalCount = page.totalCount
      }
    } else {
      let sortRows = await fetchActiveProductSortRows(supabase, kindFilter)
      if (skuTrim || barcodeTrim) {
        sortRows = filterSortRowsBySkuBarcode(sortRows, skuTrim, barcodeTrim)
      }
      const page = await loadGroupedGestaoPage(supabase, sortRows, offset, limit)
      flatRows = page.flatRows
      totalCount = page.totalCount
    }
  } catch (err) {
    console.error('[produtos-flat-list]', err)
    listLoadError = true
    flatRows = []
    totalCount = 0
  }

  return { flatRows, totalCount, listLoadError, hasSearchButNoValidTokens }
}

export async function enrichGestaoRawRowsToProductRows (
  supabase: SupabaseClient,
  flatRows: GestaoListRawRow[],
): Promise<ProductRow[]> {
  const parentNameByBling = new Map<string, string>()
  const parentNameById = new Map<string, string>()
  for (const p of flatRows) {
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    const pp = p.parent_product_id != null ? String(p.parent_product_id).trim() : ''
    if (pb || pp) continue
    parentNameById.set(p.id, String(p.name || '').trim())
    if (p.bling_id) parentNameByBling.set(String(p.bling_id).trim(), String(p.name || '').trim())
  }

  const parentBlingKeysOnPage = new Set<string>()
  for (const p of flatRows) {
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    if (pb && !parentNameByBling.has(pb)) parentBlingKeysOnPage.add(pb)
  }
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

  const parentIdsWithChildren = new Set<string>()
  const parentCandidates = flatRows.filter((p) => {
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    const pp = p.parent_product_id != null ? String(p.parent_product_id).trim() : ''
    return !pb && !pp
  })
  if (parentCandidates.length > 0) {
    const parentIds = parentCandidates.map((p) => p.id)
    const parentBlingIds = parentCandidates
      .map((p) => (p.bling_id != null ? String(p.bling_id).trim() : ''))
      .filter(Boolean)
    const CHUNK = 80
    for (let i = 0; i < parentIds.length; i += CHUNK) {
      const chunk = parentIds.slice(i, i + CHUNK)
      const { data: kids } = await supabase
        .from('products')
        .select('parent_product_id')
        .in('parent_product_id', chunk)
      for (const row of kids ?? []) {
        const pid = (row as { parent_product_id?: string | null }).parent_product_id
        if (pid) parentIdsWithChildren.add(String(pid))
      }
    }
    const blingToParentId = new Map<string, string>()
    for (const p of parentCandidates) {
      const bid = p.bling_id != null ? String(p.bling_id).trim() : ''
      if (bid) blingToParentId.set(bid, p.id)
    }
    for (let i = 0; i < parentBlingIds.length; i += CHUNK) {
      const chunk = parentBlingIds.slice(i, i + CHUNK)
      const { data: kids } = await supabase
        .from('products')
        .select('parent_bling_id')
        .in('parent_bling_id', chunk)
      for (const row of kids ?? []) {
        const pb = (row as { parent_bling_id?: string | null }).parent_bling_id
        if (!pb) continue
        const parentId = blingToParentId.get(String(pb).trim())
        if (parentId) parentIdsWithChildren.add(parentId)
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
    const pp = p.parent_product_id != null ? String(p.parent_product_id).trim() : ''
    const isVar = pb.length > 0 || pp.length > 0
    const parentName = isVar
      ? (pp && parentNameById.get(pp)) || (pb && parentNameByBling.get(pb)) || null
      : null
    return {
      ...normalized,
      is_variation: isVar,
      has_variations: parentIdsWithChildren.has(p.id),
      parent_name: parentName,
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
