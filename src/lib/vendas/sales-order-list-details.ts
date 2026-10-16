import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveEffectiveUnitCostCents } from '@/lib/vendas/sold-item-margin'
import {
  saleExitAt,
  stockAfterSale,
  taxCentsFromMargin,
  type StockMovementSign,
} from '@/lib/vendas/meli-sale-display'

export type SalesOrderListItem = {
  productId: string | null
  name: string
  sku: string | null
  imageUrl: string | null
  quantity: number
  unitPriceCents: number
  costTotalCents: number
  stockCurrent: number | null
  stockAfterSale: number | null
}

type OrderRef = {
  id: string
  total_cents?: number | null
  created_at?: string | null
}

function unwrapProduct (value: unknown): {
  name?: string | null
  sku?: string | null
  image_url?: string | null
  cost_price_cents?: number | null
} | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return row as {
    name?: string | null
    sku?: string | null
    image_url?: string | null
    cost_price_cents?: number | null
  }
}

function toInt (value: unknown): number {
  const number = Math.trunc(Number(value) || 0)
  return Number.isFinite(number) ? number : 0
}

export async function loadSalesOrderListPresentation (params: {
  supabase: SupabaseClient
  organizationId: string
  orders: OrderRef[]
}): Promise<{
  marginTaxPercent: number
  itemsByOrderId: Map<string, SalesOrderListItem[]>
}> {
  const orderIds = params.orders.map((order) => order.id).filter(Boolean)
  const empty = {
    marginTaxPercent: 0,
    itemsByOrderId: new Map<string, SalesOrderListItem[]>(),
  }
  if (orderIds.length === 0) return empty

  const [fiscalRes, itemsRes] = await Promise.all([
    params.supabase
      .from('organization_fiscal_profiles')
      .select('margin_tax_percent')
      .eq('organization_id', params.organizationId)
      .maybeSingle(),
    params.supabase
      .from('sales_order_items')
      .select(`
        sales_order_id,
        product_id,
        quantity,
        unit_price_cents,
        unit_cost_cents,
        products (
          name,
          sku,
          image_url,
          cost_price_cents
        )
      `)
      .eq('organization_id', params.organizationId)
      .in('sales_order_id', orderIds),
  ])

  const marginTaxPercent = Number(
    (fiscalRes.data as { margin_tax_percent?: number | null } | null)?.margin_tax_percent,
  ) || 0

  if (itemsRes.error) {
    console.error('[sales-orders items]', itemsRes.error.message)
    return { marginTaxPercent, itemsByOrderId: empty.itemsByOrderId }
  }

  const rows = itemsRes.data ?? []
  const productIds = [...new Set(rows.map((row) => String(row.product_id || '')).filter(Boolean))]
  const oldest = params.orders
    .map((order) => String(order.created_at || ''))
    .filter(Boolean)
    .sort()[0] || null

  const [stockRes, movementsRes] = await Promise.all([
    productIds.length > 0
      ? params.supabase.rpc('portal_products_list_stock_summary', { p_product_ids: productIds })
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? params.supabase
        .from('product_stock_movements')
        .select('product_id, sales_order_id, type, quantity, created_at')
        .eq('organization_id', params.organizationId)
        .in('product_id', productIds)
        .gte('created_at', oldest || '1970-01-01T00:00:00.000Z')
        .order('created_at', { ascending: true })
        .limit(4000)
      : Promise.resolve({ data: [], error: null }),
  ])

  const stockByProduct = new Map<string, number>()
  if (!stockRes.error && Array.isArray(stockRes.data)) {
    for (const row of stockRes.data as Array<{ product_id?: string, current_stock?: number | string }>) {
      const productId = String(row.product_id || '')
      if (!productId) continue
      const stock = Number(row.current_stock)
      stockByProduct.set(productId, Number.isFinite(stock) ? stock : 0)
    }
  }

  const movements: StockMovementSign[] = (movementsRes.error ? [] : (movementsRes.data ?? [])).map((row) => ({
    productId: String(row.product_id || ''),
    salesOrderId: row.sales_order_id != null ? String(row.sales_order_id) : null,
    type: String(row.type || ''),
    quantity: toInt(row.quantity),
    createdAt: String(row.created_at || ''),
  }))

  const itemsByOrderId = new Map<string, SalesOrderListItem[]>()
  for (const row of rows) {
    const orderId = String(row.sales_order_id || '')
    if (!orderId) continue
    const product = unwrapProduct(row.products)
    const productId = row.product_id != null ? String(row.product_id) : null
    const stockCurrent = productId && stockByProduct.has(productId)
      ? stockByProduct.get(productId) ?? null
      : null
    const saleAt = productId
      ? saleExitAt(movements, orderId, productId)
      : null
    const after = productId != null && stockCurrent != null
      ? stockAfterSale({
        currentStock: stockCurrent,
        saleAt,
        movements,
        productId,
      })
      : null
    const quantity = Math.max(1, toInt(row.quantity) || 1)
    const unitCostCents = resolveEffectiveUnitCostCents({
      hasProduct: Boolean(productId),
      lineUnitCostCents: toInt(row.unit_cost_cents),
      productCostCents: product?.cost_price_cents,
    })
    const item: SalesOrderListItem = {
      productId,
      name: String(product?.name || '').trim() || 'Produto não vinculado',
      sku: product?.sku ? String(product.sku) : null,
      imageUrl: product?.image_url && String(product.image_url).trim()
        ? String(product.image_url).trim()
        : null,
      quantity,
      unitPriceCents: Math.max(0, toInt(row.unit_price_cents)),
      costTotalCents: (unitCostCents ?? 0) * quantity,
      stockCurrent,
      stockAfterSale: after,
    }
    const list = itemsByOrderId.get(orderId) ?? []
    list.push(item)
    itemsByOrderId.set(orderId, list)
  }

  return { marginTaxPercent, itemsByOrderId }
}

export function orderTaxCents (totalCents: number, marginTaxPercent: number): number {
  return taxCentsFromMargin(totalCents, marginTaxPercent)
}
