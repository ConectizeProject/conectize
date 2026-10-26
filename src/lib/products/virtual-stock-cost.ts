import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeVirtualKitCostCents,
  loadProductStockComponents,
} from '@/lib/products/virtual-stock'

export const VIRTUAL_COST_LOCKED_MESSAGE =
  'O custo deste produto é a soma da composição virtual e não pode ser alterado.'

export async function fetchProductHasVirtualStock (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productId: string
}): Promise<boolean> {
  const productId = String(params.productId || '').trim()
  if (!productId) return false

  let query = params.supabase
    .from('product_stock_components')
    .select('id')
    .eq('product_id', productId)
    .limit(1)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { data, error } = await query
  if (error) {
    if (/product_stock_components|schema cache|does not exist/i.test(error.message)) return false
    console.error('[virtual-stock-cost has]', error.message)
    return false
  }
  return (data ?? []).length > 0
}

export async function resolveVirtualKitCostCentsByProductId (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productIds: string[]
}): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const ids = [...new Set(params.productIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 0) return out

  const componentsByProduct = await loadProductStockComponents({
    supabase: params.supabase,
    organizationId: params.organizationId,
    productIds: ids,
  })
  const componentIds = [
    ...new Set(
      [...componentsByProduct.values()].flat().map((row) => row.componentProductId),
    ),
  ]
  if (componentIds.length === 0) return out

  let costQuery = params.supabase
    .from('products')
    .select('id, cost_price_cents')
    .in('id', componentIds)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) costQuery = costQuery.eq('organization_id', organizationId)

  const { data, error } = await costQuery
  if (error) {
    console.error('[virtual-stock-cost load]', error.message)
    return out
  }

  const costById = new Map<string, number>()
  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id || '')
    if (!id) continue
    const cents = Math.max(
      0,
      Math.round(Number((row as { cost_price_cents?: number | null }).cost_price_cents) || 0),
    )
    costById.set(id, cents)
  }

  for (const [productId, components] of componentsByProduct) {
    if (components.length === 0) continue
    out.set(productId, computeVirtualKitCostCents(
      components.map((row) => ({
        quantityPerUnit: row.quantityPerUnit,
        unitCostCents: costById.get(row.componentProductId) ?? 0,
      })),
    ))
  }
  return out
}

export async function persistVirtualProductCostFromComponents (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productId: string
}): Promise<{ ok: true, isVirtual: boolean, costPriceCents: number | null }> {
  const productId = String(params.productId || '').trim()
  if (!productId) {
    return { ok: true, isVirtual: false, costPriceCents: null }
  }

  const costs = await resolveVirtualKitCostCentsByProductId({
    supabase: params.supabase,
    organizationId: params.organizationId,
    productIds: [productId],
  })
  if (!costs.has(productId)) {
    return { ok: true, isVirtual: false, costPriceCents: null }
  }

  const costPriceCents = costs.get(productId) ?? 0
  let currentQuery = params.supabase
    .from('products')
    .select('cost_price_cents')
    .eq('id', productId)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) currentQuery = currentQuery.eq('organization_id', organizationId)

  const { data: current } = await currentQuery.maybeSingle()
  const stored = Math.round(Number((current as { cost_price_cents?: number | null } | null)?.cost_price_cents) || 0)
  if (stored === costPriceCents) {
    return { ok: true, isVirtual: true, costPriceCents }
  }

  let updateQuery = params.supabase
    .from('products')
    .update({
      cost_price_cents: costPriceCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
  if (organizationId) updateQuery = updateQuery.eq('organization_id', organizationId)

  const { error } = await updateQuery
  if (error) {
    console.error('[virtual-stock-cost persist]', error.message)
  }
  return { ok: true, isVirtual: true, costPriceCents }
}

export async function persistDependentVirtualKitCosts (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  componentProductId: string
}): Promise<void> {
  const componentProductId = String(params.componentProductId || '').trim()
  if (!componentProductId) return

  let query = params.supabase
    .from('product_stock_components')
    .select('product_id')
    .eq('component_product_id', componentProductId)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { data, error } = await query
  if (error) {
    if (/product_stock_components|schema cache|does not exist/i.test(error.message)) return
    console.error('[virtual-stock-cost dependents]', error.message)
    return
  }

  const kitIds = [
    ...new Set(
      (data ?? [])
        .map((row) => String((row as { product_id?: string }).product_id || '').trim())
        .filter(Boolean),
    ),
  ]
  for (const productId of kitIds) {
    await persistVirtualProductCostFromComponents({
      supabase: params.supabase,
      organizationId: params.organizationId,
      productId,
    })
  }
}
