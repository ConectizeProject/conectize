import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { effectiveSearchTokens } from '@/lib/products/product-search'

export async function GET (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const kindParam = String(searchParams.get('kind') || '').trim()
  const kind = kindParam === 'service' ? 'service' : kindParam === 'product' ? 'product' : null
  const q = String(searchParams.get('q') || '').trim()
  const tokens = effectiveSearchTokens(q)

  const supabase = auth.supabase
  let query = supabase
    .from('products')
    .select('id, name, sku, barcode, kind, sale_price_cents, cost_price_cents, image_url, is_active, parent_bling_id, parent_product_id')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(30)

  if (kind) {
    query = query.eq('kind', kind)
  }

  if (q && tokens.length === 0) {
    return NextResponse.json({ ok: true, items: [] })
  }

  if (tokens.length > 0) {
    for (const token of tokens) {
      query = query.or(
        `name.ilike.%${token}%,sku.ilike.%${token}%,barcode.ilike.%${token}%`,
      )
    }
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  type ProductRow = {
    id: string
    name?: string | null
    sku?: string | null
    barcode?: string | null
    kind?: string | null
    sale_price_cents?: number | null
    cost_price_cents?: number | null
    image_url?: string | null
    parent_product_id?: string | null
  }

  const productIds = (data ?? [])
    .filter((row: ProductRow) => row.kind !== 'service')
    .map((row: ProductRow) => String(row.id))

  const stockById = new Map<string, number>()
  if (productIds.length > 0) {
    const { data: stockRows } = await supabase.rpc(
      'portal_products_list_stock_summary',
      { p_product_ids: productIds },
    )
    type StockRow = { product_id?: string | null; current_stock?: number | string | null }
    for (const row of (stockRows ?? []) as StockRow[]) {
      const productId = String(row.product_id || '').trim()
      if (!productId) continue
      const stockNum = Number(row.current_stock ?? 0)
      stockById.set(productId, Number.isFinite(stockNum) ? stockNum : 0)
    }
  }

  const parentIds = (data ?? []).map((row: ProductRow) => String(row.id))
  const parentWithVariations = new Set<string>()
  if (parentIds.length > 0) {
    const { data: variationRows } = await supabase
      .from('products')
      .select('parent_product_id')
      .in('parent_product_id', parentIds)
      .limit(200)

    type VariationRow = { parent_product_id?: string | null }
    for (const row of (variationRows ?? []) as VariationRow[]) {
      const parentId = String(row.parent_product_id || '').trim()
      if (parentId) parentWithVariations.add(parentId)
    }
  }

  const items = (data ?? []).map((row: ProductRow) => ({
    id: String(row.id),
    name: String(row.name || '').trim(),
    sku: row.sku ? String(row.sku) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    kind: row.kind === 'service' ? 'service' : 'product',
    salePriceCents: typeof row.sale_price_cents === 'number' ? row.sale_price_cents : 0,
    costPriceCents: typeof row.cost_price_cents === 'number' ? row.cost_price_cents : 0,
    imageUrl: row.image_url ? String(row.image_url) : null,
    currentStock: row.kind === 'service' ? null : (stockById.get(String(row.id)) ?? 0),
    isVariation: Boolean(row.parent_product_id),
    hasVariations: parentWithVariations.has(String(row.id)),
  }))

  return NextResponse.json({ ok: true, items })
}

