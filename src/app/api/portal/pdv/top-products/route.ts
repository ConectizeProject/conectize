import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

const PRODUCT_SELECT = 'id, name, sku, barcode, sale_price_cents, cost_price_cents, image_url'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 5)
  const limit = Math.min(40, Math.max(1, Number.isFinite(limitRaw) ? Math.round(limitRaw) : 5))

  const { data: paidOrders, error: ordersError } = await auth.supabase
    .from('sales_orders')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(500)

  if (ordersError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const orderIds = (paidOrders ?? []).map((row) => String(row.id))
  const ranked: Array<{ product: Record<string, unknown>, qty: number }> = []
  const seenIds = new Set<string>()

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await auth.supabase
      .from('sales_order_items')
      .select('product_id, quantity, products(id, name, sku, barcode, sale_price_cents, cost_price_cents, image_url)')
      .eq('organization_id', auth.organizationId)
      .in('sales_order_id', orderIds)

    if (!itemsError) {
      const qtyByProduct = new Map<string, { product: Record<string, unknown>, qty: number }>()
      for (const row of items ?? []) {
        const productId = String((row as { product_id?: string }).product_id || '')
        if (!productId) continue
        const qty = Math.max(0, Number((row as { quantity?: number }).quantity) || 0)
        const rawProducts = (row as { products?: unknown }).products
        const product = (Array.isArray(rawProducts) ? rawProducts[0] : rawProducts) as Record<string, unknown> | null
        const existing = qtyByProduct.get(productId)
        if (existing) {
          existing.qty += qty
        } else if (product && typeof product === 'object') {
          qtyByProduct.set(productId, { product, qty })
        }
      }

      const topSold = Array.from(qtyByProduct.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit)

      for (const entry of topSold) {
        const id = String(entry.product.id || '')
        if (!id || seenIds.has(id)) continue
        seenIds.add(id)
        ranked.push(entry)
      }
    }
  }

  if (ranked.length < limit) {
    const { data: catalogProducts, error: catalogError } = await auth.supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('organization_id', auth.organizationId)
      .eq('is_active', true)
      .eq('kind', 'product')
      .order('name', { ascending: true })
      .limit(limit + seenIds.size)

    if (catalogError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

    for (const product of catalogProducts ?? []) {
      if (ranked.length >= limit) break
      const id = String(product.id || '')
      if (!id || seenIds.has(id)) continue
      seenIds.add(id)
      ranked.push({ product: product as Record<string, unknown>, qty: 0 })
    }
  }

  const productIds = ranked.map((entry) => String(entry.product.id || ''))
  let stockById = new Map<string, number>()
  if (productIds.length > 0) {
    const { data: stockRows } = await auth.supabase.rpc('portal_products_list_stock_summary', {
      p_product_ids: productIds,
    })
    stockById = new Map((stockRows ?? []).map((row: { product_id: string, current_stock: number | string }) => {
      const raw = row.current_stock
      const n = typeof raw === 'number' ? raw : Number(raw)
      return [String(row.product_id), Number.isFinite(n) ? n : 0]
    }))
  }

  const products = ranked.map(({ product, qty }) => ({
    ...product,
    sold_qty: qty,
    stock: stockById.get(String(product.id)) ?? 0,
  }))

  return NextResponse.json({ ok: true, products, limit })
}
