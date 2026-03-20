import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPortalAuth, createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductsListClient } from './ProductsListClient'
import { ProdutosFilterForm } from './ProdutosFilterForm'
import type { ProductRow } from './ProductsListClient'
import { ImportFromBlingButton } from './ImportFromBlingButton'
import { BackfillFromBlingButton } from './BackfillFromBlingButton'
import { effectiveSearchTokens } from '@/lib/products/product-search'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string; page?: string }>

export default async function ProdutosPage ({ searchParams }: { searchParams: SearchParams }) {
  const { q, page } = await searchParams
  const query = String(q || '').trim()
  const pageNumber = Math.max(1, Number(page) || 1)
  const pageSize = 100
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
  }

  type MovementRow = {
    product_id: string
    type: string
    quantity: number
    unit_value_cents?: number
    created_at?: string
  }

  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')

  const supabase = await createSupabaseServerClient()

  // 1) Pais paginados
  let parentsQuery = supabase
    .from('products')
    .select('id, bling_id, bling_sync_pending, kind, name, sku, barcode, image_url, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, is_active, created_at', { count: 'exact' })
    .is('parent_bling_id', null)
    .order('created_at', { ascending: false })

  // Para o filtro `q`, buscar também por variações:
  // Várias palavras: cada uma deve aparecer (AND), em qualquer ordem, em nome OU sku OU barcode.
  // PostgREST: vários `.or()` na URL viram (or1) AND (or2) AND ...
  const searchTokens = effectiveSearchTokens(query)
  const hasSearchButNoValidTokens = Boolean(query.trim()) && searchTokens.length === 0

  if (hasSearchButNoValidTokens) {
    parentsQuery = parentsQuery.in('id', ['__no_matches__'])
  } else if (searchTokens.length > 0) {
    let directParentsQuery = supabase
      .from('products')
      .select('id, bling_id')
      .is('parent_bling_id', null)
    for (const token of searchTokens) {
      directParentsQuery = directParentsQuery.or(
        `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
      )
    }

    let variationsQuery = supabase
      .from('products')
      .select('parent_bling_id')
      .not('parent_bling_id', 'is', null)
    for (const token of searchTokens) {
      variationsQuery = variationsQuery.or(
        `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
      )
    }

    const { data: directParentsData } = await directParentsQuery
    const { data: variationsData } = await variationsQuery

    const parentBlingIdsFromVariations = (variationsData ?? [])
      .map((row: { parent_bling_id?: string | null }) => row.parent_bling_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    let variationParentsIds: string[] = []
    if (parentBlingIdsFromVariations.length > 0) {
      const { data: variationParentsData } = await supabase
        .from('products')
        .select('id')
        .is('parent_bling_id', null)
        .in('bling_id', parentBlingIdsFromVariations)

      variationParentsIds = (variationParentsData ?? []).map((row: { id?: string }) => String(row.id))
    }

    const directParentsIds = (directParentsData ?? []).map((row: { id?: string }) => String(row.id))
    const matchingParentIds = new Set<string>([...directParentsIds, ...variationParentsIds])
    const matchingIdsArray = Array.from(matchingParentIds)

    if (matchingIdsArray.length > 0) {
      parentsQuery = parentsQuery.in('id', matchingIdsArray)
    } else {
      parentsQuery = parentsQuery.in('id', ['__no_matches__'])
    }
  }

  const { data: parentProducts } = await parentsQuery
    .range(offset, offset + pageSize - 1)

  const parents = parentProducts ?? []

  // 2) Filhos (variações) de todos os pais desta página
  const parentBlingIds = parents
    .map((p: { bling_id?: string | null }) => p.bling_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  let children: Raw[] = []
  if (parentBlingIds.length > 0) {
    let childrenQuery = supabase
      .from('products')
      .select('id, bling_id, bling_sync_pending, parent_bling_id, name, sku, barcode, image_url, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, is_active, created_at')
      .in('parent_bling_id', parentBlingIds)

    if (searchTokens.length > 0) {
      for (const token of searchTokens) {
        childrenQuery = childrenQuery.or(
          `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
        )
      }
    }

    const { data: childrenData } = await childrenQuery
    children = childrenData ?? []
  }

  // 3) Estoque para pais + filhos
  const allProducts = [...parents, ...children]

  const stockByProductId: Record<string, number> = {}
  const lastEntryCostByProductId: Record<string, number> = {}
  const lastEntryDateByProductId: Record<string, number> = {}
  const hasStockMovementsByProductId: Record<string, boolean> = {}

  if (allProducts.length > 0) {
    const ids = allProducts.map((p: { id: string }) => p.id)
    const { data: movements, error: movementsError } = await supabase
      .from('product_stock_movements')
      .select('product_id, type, quantity, unit_value_cents, created_at')
      .in('product_id', ids)
      .limit(10000)

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

  function listDisplayCostCents (p: Raw): number | null {
    const rowCost = typeof p.cost_price_cents === 'number' ? p.cost_price_cents : null
    const manualMs = p.cost_price_manual_edited_at
      ? new Date(p.cost_price_manual_edited_at).getTime()
      : 0
    const entryCents = lastEntryCostByProductId[p.id]
    const entryMs = lastEntryDateByProductId[p.id] ?? 0
    const hasEntry =
      typeof entryCents === 'number' &&
      entryCents > 0 &&
      Number.isFinite(entryMs) &&
      entryMs > 0

    if (hasEntry && entryMs > manualMs) {
      return entryCents
    }
    if (rowCost != null) return rowCost
    if (typeof entryCents === 'number' && entryCents > 0) return entryCents
    return null
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
    cost_price_cents: listDisplayCostCents(p),
    is_active: p.is_active ?? true,
    created_at: p.created_at,
    current_stock: stockByProductId[p.id] ?? 0,
    has_stock_movements: hasStockMovementsByProductId[p.id] ?? false,
  })

  const parentRows = parents.map((p: Raw) => normalize(p))
  const childRows = children.map((p: Raw) => normalize(p))

  const byParentBlingId = new Map<string, typeof parentRows[0]>()
  for (const p of parentRows) {
    if (p.bling_id) {
      byParentBlingId.set(p.bling_id, p)
    }
  }

  const childrenByParentId = new Map<string, typeof childRows>()
  for (const child of childRows) {
    const parentBlingId = child.parent_bling_id
    if (!parentBlingId) continue
    const parent = byParentBlingId.get(parentBlingId)
    if (!parent) continue
    const arr = childrenByParentId.get(parent.id) ?? []
    arr.push(child)
    childrenByParentId.set(parent.id, arr)
  }

  const productsWithStock: ProductRow[] = parentRows.flatMap((parent) => {
    const parentRow = {
      ...parent,
      is_variation: false,
      parent_name: null as string | null,
    }
    const vars = (childrenByParentId.get(parent.id) ?? [])
      .sort((a, b) => {
        const an = (a.name || '').toLowerCase()
        const bn = (b.name || '').toLowerCase()
        if (an < bn) return -1
        if (an > bn) return 1
        return 0
      })
      .map((child) => ({
        ...child,
        is_variation: true,
        parent_name: parent.name,
      }))
    return [parentRow, ...vars]
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Produtos e serviços</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo central de itens utilizados nas ordens de serviço e integrações com o Bling.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <div className="flex items-center gap-2">
            <ImportFromBlingButton />
            <Button variant="outline" asChild>
              <Link href="/portal/produtos/novo">Novo produto/serviço</Link>
            </Button>
          </div>
          <BackfillFromBlingButton />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProdutosFilterForm key={query} initialQ={query} />
        </CardContent>
      </Card>

      {/* key: remonta a lista ao mudar busca/página — evita menu Radix/modais presos bloqueando cliques */}
      <ProductsListClient key={`${query}::${pageNumber}`} products={productsWithStock} />
    </div>
  )
}

