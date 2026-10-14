import type { SupabaseClient } from '@supabase/supabase-js'
import type { AbcSkuRow } from '@/lib/reports/abc-curve'

const PAGE_SIZE = 1000
const MAX_PAGES = 30

type ItemRow = {
  id?: string
  product_id?: string | null
  subtotal_cents?: number | null
  products?: {
    id?: string
    name?: string | null
    sku?: string | null
    kind?: string | null
    parent_product_id?: string | null
  } | Array<{
    id?: string
    name?: string | null
    sku?: string | null
    kind?: string | null
    parent_product_id?: string | null
  }> | null
}

function unwrapProduct (raw: ItemRow['products']) {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] || null : raw
}

export async function loadAbcSkus (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AbcSkuRow[]> {
  const revenueByProduct = new Map<string, AbcSkuRow>()
  let lastId = ''

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase
      .from('sales_order_items')
      .select('id, product_id, subtotal_cents, products(id, name, sku, kind, parent_product_id), sales_orders!inner(status)')
      .eq('organization_id', organizationId)
      .eq('sales_orders.status', 'paid')
      .order('id', { ascending: true })
      .limit(PAGE_SIZE)
    if (lastId) query = query.gt('id', lastId)

    const { data, error } = await query
    if (error) {
      console.error('[curva-abc] itens', error.message)
      break
    }
    const rows = (data || []) as ItemRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const product = unwrapProduct(row.products)
      const productId = String(row.product_id || product?.id || '')
      const revenue = Number(row.subtotal_cents) || 0
      if (!productId || revenue <= 0 || product?.kind === 'service') continue
      const current = revenueByProduct.get(productId)
      if (current) {
        current.revenueCents += revenue
        continue
      }
      revenueByProduct.set(productId, {
        id: productId,
        name: String(product?.name || 'Produto sem nome'),
        sku: product?.sku ? String(product.sku) : null,
        parentId: product?.parent_product_id ? String(product.parent_product_id) : null,
        parentName: null,
        parentSku: null,
        revenueCents: revenue,
      })
    }

    lastId = String(rows[rows.length - 1]?.id || '')
    if (rows.length < PAGE_SIZE || !lastId) break
  }

  const parentIds = Array.from(new Set(
    Array.from(revenueByProduct.values()).map((row) => row.parentId).filter((id): id is string => Boolean(id)),
  ))
  for (let index = 0; index < parentIds.length; index += 200) {
    const chunk = parentIds.slice(index, index + 200)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('organization_id', organizationId)
      .in('id', chunk)
    if (error) {
      console.error('[curva-abc] pais', error.message)
      continue
    }
    const parents = new Map((data || []).map((row) => [String(row.id), row]))
    for (const sku of revenueByProduct.values()) {
      if (!sku.parentId) continue
      const parent = parents.get(sku.parentId)
      if (!parent) continue
      sku.parentName = parent.name ? String(parent.name) : null
      sku.parentSku = parent.sku ? String(parent.sku) : null
    }
  }

  return Array.from(revenueByProduct.values())
}
