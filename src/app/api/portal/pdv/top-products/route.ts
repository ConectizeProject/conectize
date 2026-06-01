import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: paidOrders, error: ordersError } = await auth.supabase
    .from('sales_orders')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'paid')

  if (ordersError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const orderIds = (paidOrders ?? []).map((row) => String(row.id))
  let sorted: Array<{ product: Record<string, unknown>, qty: number }> = []

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await auth.supabase
      .from('sales_order_items')
      .select('product_id, quantity, products(id, name, sku, barcode, sale_price_cents, image_url)')
      .eq('organization_id', auth.organizationId)
      .in('sales_order_id', orderIds)

    if (itemsError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

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

    sorted = Array.from(qtyByProduct.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }

  if (sorted.length === 0) {
    const { data: fallbackProducts, error: fallbackError } = await auth.supabase
      .from('products')
      .select('id, name, sku, barcode, sale_price_cents, image_url')
      .eq('organization_id', auth.organizationId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (fallbackError) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

    sorted = (fallbackProducts ?? []).map((product) => ({
      product: product as Record<string, unknown>,
      qty: 0,
    }))
  }

  const productIds = sorted.map((entry) => String(entry.product.id || ''))
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

  const products = sorted.map(({ product, qty }) => ({
    ...product,
    sold_qty: qty,
    stock: stockById.get(String(product.id)) ?? 0,
  }))

  return NextResponse.json({ ok: true, products })
}
