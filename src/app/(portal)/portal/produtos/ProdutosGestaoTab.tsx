import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { ProductsListClient } from './ProductsListClient'
import { ProdutosFilterForm } from './ProdutosFilterForm'
import type { ProductRow } from './ProductsListClient'
import { effectiveSearchTokens } from '@/lib/products/product-search'
import {
  compareFlatCatalogSort,
  expandSearchVisibleProductIds,
  fetchIdSortRowsInChunks,
  fetchProductsByIdsOrdered,
} from '@/lib/products/produtos-flat-list'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'

const PAGE_SIZE = 100

const PRODUCT_LIST_SELECT =
  'id, bling_id, bling_sync_pending, kind, name, sku, barcode, image_url, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, is_active, created_at, catalog_sort_key, parent_bling_id'

export function buildProdutosGestaoHref (q: string, page: number, kind: 'product' | 'service'): string {
  const params = new URLSearchParams()
  params.set('tab', 'gestao')
  const trimmed = q.trim()
  if (trimmed) params.set('q', trimmed)
  if (kind === 'service') params.set('kind', 'service')
  if (page > 1) params.set('page', String(page))
  return `/portal/produtos?${params.toString()}`
}

type ProdutosGestaoTabProps = {
  q: string
  page: string
  kind: string
  /** Abre a modal de edição ao carregar (ex.: link da página de detalhes ou URL antiga /:id/editar). */
  initialEditProductId?: string
  /** Abre a modal de criação de variação vinculada ao produto pai. */
  initialCreateVariationParentId?: string
}

export async function ProdutosGestaoTab ({
  q,
  page,
  kind,
  initialEditProductId,
  initialCreateVariationParentId,
}: ProdutosGestaoTabProps) {
  const query = String(q || '').trim()
  const pageNumber = Math.max(1, Number(page) || 1)
  const kindFilter: 'product' | 'service' = String(kind || '').trim() === 'service' ? 'service' : 'product'
  const pageSize = PAGE_SIZE
  const offset = (pageNumber - 1) * pageSize

  type Raw = {
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

  const supabase = await createSupabaseServerClient()

  const searchTokens = effectiveSearchTokens(query)
  const hasSearchButNoValidTokens = Boolean(query.trim()) && searchTokens.length === 0

  let flatRows: Raw[] = []
  let totalCount = 0
  /** Falha ao listar no Supabase (não confundir com lista vazia legítima). */
  let listLoadError = false

  if (hasSearchButNoValidTokens) {
    if (pageNumber > 1) redirect(buildProdutosGestaoHref(query, 1, kindFilter))
    flatRows = []
    totalCount = 0
  } else if (searchTokens.length > 0 && kindFilter === 'product') {
    const visibleIds = await expandSearchVisibleProductIds(supabase, searchTokens)
    if (visibleIds.size === 0) {
      if (pageNumber > 1) redirect(buildProdutosGestaoHref(query, 1, kindFilter))
      flatRows = []
      totalCount = 0
    } else {
      const sortRows = await fetchIdSortRowsInChunks(supabase, [...visibleIds])
      sortRows.sort(compareFlatCatalogSort)
      totalCount = sortRows.length

      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      if (totalCount > 0 && pageNumber > totalPages) {
        redirect(buildProdutosGestaoHref(query, totalPages, kindFilter))
      }
      if (totalCount === 0 && pageNumber > 1) {
        redirect(buildProdutosGestaoHref(query, 1, kindFilter))
      }

      const pageSlice = sortRows.slice(offset, offset + pageSize)
      const orderedIds = pageSlice.map((r) => r.id)
      const full = await fetchProductsByIdsOrdered(supabase, orderedIds, PRODUCT_LIST_SELECT)
      flatRows = full as Raw[]
    }
  } else if (searchTokens.length > 0 && kindFilter === 'service') {
    let serviceQuery = supabase
      .from('products')
      .select(PRODUCT_LIST_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .eq('kind', 'service')
      .order('catalog_sort_key', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    for (const token of searchTokens) {
      serviceQuery = serviceQuery.or(
        `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
      )
    }

    const { data, count, error } = await serviceQuery
    if (error) {
      console.error('[servicos-flat-list]', error)
      listLoadError = true
      flatRows = []
      totalCount = 0
    } else {
      flatRows = (data ?? []) as Raw[]
      totalCount = typeof count === 'number' ? count : flatRows.length
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    if (totalCount > 0 && pageNumber > totalPages) {
      redirect(buildProdutosGestaoHref(query, totalPages, kindFilter))
    }
    if (totalCount === 0 && pageNumber > 1) {
      redirect(buildProdutosGestaoHref(query, 1, kindFilter))
    }
  } else {
    let queryBuilder = supabase
      .from('products')
      .select(PRODUCT_LIST_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .order('catalog_sort_key', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (kindFilter === 'service') {
      queryBuilder = queryBuilder.eq('kind', 'service')
    } else {
      queryBuilder = queryBuilder.neq('kind', 'service')
    }

    const { data, count, error } = await queryBuilder

    if (error) {
      console.error('[produtos-flat-list]', error)
      listLoadError = true
      flatRows = []
      totalCount = 0
    } else {
      flatRows = (data ?? []) as Raw[]
      totalCount = typeof count === 'number' ? count : flatRows.length
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    if (totalCount > 0 && pageNumber > totalPages) {
      redirect(buildProdutosGestaoHref(query, totalPages, kindFilter))
    }
    if (totalCount === 0 && pageNumber > 1) {
      redirect(buildProdutosGestaoHref(query, 1, kindFilter))
    }
  }

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

  const normalize = (p: Raw) => ({
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

  const productsWithStock: ProductRow[] = flatRows.map((p) => {
    const normalized = normalize(p)
    const pb = p.parent_bling_id != null ? String(p.parent_bling_id).trim() : ''
    const isVar = pb.length > 0
    return {
      ...normalized,
      is_variation: isVar,
      parent_name: isVar ? (parentNameByBling.get(pb) || null) : null,
    }
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const pagination =
    totalCount > 0 && totalPages > 1
      ? {
          page: pageNumber,
          pageSize,
          totalCount,
          totalPages,
          prevHref: pageNumber > 1 ? buildProdutosGestaoHref(query, pageNumber - 1, kindFilter) : null,
          nextHref: pageNumber < totalPages ? buildProdutosGestaoHref(query, pageNumber + 1, kindFilter) : null,
        }
      : null

  const rangeStart = totalCount === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + flatRows.length, totalCount)
  const paginationRangeLabel = hasSearchButNoValidTokens
    ? 'Nenhum resultado para o termo informado'
    : totalCount === 0
      ? '0 resultados'
      : totalPages > 1
        ? `${rangeStart}–${rangeEnd} de ${totalCount}`
        : `${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <Card className="min-w-0 max-w-full">
        <CardContent className="min-w-0 pt-4 sm:pt-6">
          <ProdutosFilterForm key={`${kindFilter}:${query}`} initialQ={query} kind={kindFilter} withGestaoTab />
        </CardContent>
      </Card>

      <ProductsListClient
        key={`${kindFilter}::${query}::${pageNumber}`}
        products={productsWithStock}
        pagination={pagination}
        paginationRangeLabel={paginationRangeLabel}
        listLoadError={listLoadError}
        searchQuery={query}
        invalidSearchTokens={hasSearchButNoValidTokens}
        initialFilterType={kindFilter}
        initialEditProductId={initialEditProductId}
        initialCreateVariationParentId={initialCreateVariationParentId}
        tabHrefs={{
          products: buildProdutosGestaoHref(query, 1, 'product'),
          services: buildProdutosGestaoHref(query, 1, 'service'),
        }}
      />
    </div>
  )
}
