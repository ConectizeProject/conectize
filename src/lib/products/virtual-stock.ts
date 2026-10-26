import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductStockComponent = {
  productId: string
  componentProductId: string
  quantityPerUnit: number
}

export type VirtualStockBalance = {
  productId: string
  isVirtual: boolean
  currentStock: number
  components: Array<{
    componentProductId: string
    quantityPerUnit: number
    componentStock: number
    kitsAvailable: number
  }>
}

/** Extrai multiplicador de SKUs tipo 3XTMDADPTMKB ou TMDADPTMKB-04X. */
export function parseSkuKitMultiplier (skuRaw: string, baseSku: string): number | null {
  const sku = String(skuRaw || '').trim().toUpperCase().replace(/\s+/g, '')
  const base = String(baseSku || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!sku || !base || sku === base || !sku.includes(base)) return null

  const prefix = sku.match(new RegExp(`^(\\d+)X${escapeRegExp(base)}$`))
  if (prefix) return Math.max(1, Number(prefix[1]) || 1)

  const suffix = sku.match(new RegExp(`^${escapeRegExp(base)}-(\\d+)X$`))
  if (suffix) return Math.max(1, Number(suffix[1]) || 1)

  return null
}

function escapeRegExp (value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Custo do kit virtual: soma de (custo do componente × quantidade por unidade). */
export function computeVirtualKitCostCents (
  components: Array<{ quantityPerUnit: number, unitCostCents: number | null | undefined }>,
): number {
  let sum = 0
  for (const row of components) {
    const qty = Math.max(1, Math.trunc(Number(row.quantityPerUnit) || 1))
    const cost = Math.max(0, Math.round(Number(row.unitCostCents) || 0))
    sum += qty * cost
  }
  return sum
}

export function computeVirtualStockFromComponents (
  components: Array<{ quantityPerUnit: number, componentStock: number }>,
): number {
  if (components.length === 0) return 0
  let min = Number.POSITIVE_INFINITY
  for (const row of components) {
    const qty = Math.max(1, Math.trunc(Number(row.quantityPerUnit) || 1))
    const stock = Number(row.componentStock)
    const available = Number.isFinite(stock) ? stock : 0
    const kits = Math.floor(available / qty)
    if (kits < min) min = kits
  }
  if (!Number.isFinite(min) || min < 0) return 0
  return Math.trunc(min)
}

function movementBalance (
  rows: Array<{ type?: string | null, quantity?: number | null }>,
): number {
  let balance = 0
  for (const row of rows) {
    const type = String(row.type || '').toLowerCase()
    const quantity = Number(row.quantity) || 0
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (type === 'entry') balance += quantity
    else if (type === 'exit' || type === 'loss') balance -= quantity
  }
  return balance
}

export async function loadProductStockComponents (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productIds: string[]
}): Promise<Map<string, ProductStockComponent[]>> {
  const out = new Map<string, ProductStockComponent[]>()
  const ids = [...new Set(params.productIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 0) return out

  let query = params.supabase
    .from('product_stock_components')
    .select('product_id, component_product_id, quantity_per_unit')
    .in('product_id', ids)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { data, error } = await query

  if (error) {
    // Tabela ainda não migrada: segue sem composição.
    if (/product_stock_components|schema cache|does not exist/i.test(error.message)) {
      return out
    }
    console.error('[virtual-stock components]', error.message)
    return out
  }

  for (const row of data ?? []) {
    const productId = String((row as { product_id?: string }).product_id || '')
    const componentProductId = String((row as { component_product_id?: string }).component_product_id || '')
    const quantityPerUnit = Math.max(
      1,
      Math.trunc(Number((row as { quantity_per_unit?: number }).quantity_per_unit) || 1),
    )
    if (!productId || !componentProductId) continue
    const list = out.get(productId) ?? []
    list.push({ productId, componentProductId, quantityPerUnit })
    out.set(productId, list)
  }
  return out
}

export async function loadPhysicalStockByProductId (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productIds: string[]
}): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const ids = [...new Set(params.productIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 0) return out

  let query = params.supabase
    .from('product_stock_movements')
    .select('product_id, type, quantity')
    .in('product_id', ids)
  const organizationId = String(params.organizationId || '').trim()
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { data, error } = await query

  if (error) {
    console.error('[virtual-stock physical]', error.message)
    return out
  }

  const byProduct = new Map<string, Array<{ type?: string | null, quantity?: number | null }>>()
  for (const row of data ?? []) {
    const productId = String((row as { product_id?: string }).product_id || '')
    if (!productId) continue
    const list = byProduct.get(productId) ?? []
    list.push(row as { type?: string | null, quantity?: number | null })
    byProduct.set(productId, list)
  }

  for (const id of ids) {
    out.set(id, movementBalance(byProduct.get(id) ?? []))
  }
  return out
}

/** Resolve estoque exibido: físico ou virtual (mínimo dos componentes). */
export async function resolveDisplayedStockByProductId (params: {
  supabase: SupabaseClient
  organizationId?: string | null
  productIds: string[]
  physicalStockByProductId?: Map<string, number>
}): Promise<Map<string, VirtualStockBalance>> {
  const ids = [...new Set(params.productIds.map((id) => String(id || '').trim()).filter(Boolean))]
  const out = new Map<string, VirtualStockBalance>()
  if (ids.length === 0) return out

  const componentsByProduct = await loadProductStockComponents({
    supabase: params.supabase,
    organizationId: params.organizationId,
    productIds: ids,
  })

  const componentIds = [
    ...new Set(
      [...componentsByProduct.values()]
        .flat()
        .map((row) => row.componentProductId),
    ),
  ]

  const physicalIds = [
    ...new Set([
      ...ids.filter((id) => !componentsByProduct.has(id)),
      ...componentIds,
    ]),
  ]

  const physical = params.physicalStockByProductId
    ? new Map(params.physicalStockByProductId)
    : await loadPhysicalStockByProductId({
      supabase: params.supabase,
      organizationId: params.organizationId,
      productIds: physicalIds,
    })

  // Completa físicos ausentes no mapa informado.
  if (params.physicalStockByProductId) {
    const missing = physicalIds.filter((id) => !physical.has(id))
    if (missing.length > 0) {
      const loaded = await loadPhysicalStockByProductId({
        supabase: params.supabase,
        organizationId: params.organizationId,
        productIds: missing,
      })
      for (const [id, stock] of loaded) physical.set(id, stock)
    }
  }

  for (const productId of ids) {
    const components = componentsByProduct.get(productId) ?? []
    if (components.length === 0) {
      out.set(productId, {
        productId,
        isVirtual: false,
        currentStock: physical.get(productId) ?? 0,
        components: [],
      })
      continue
    }

    const detailed = components.map((row) => {
      const componentStock = physical.get(row.componentProductId) ?? 0
      const kitsAvailable = Math.floor(componentStock / row.quantityPerUnit)
      return {
        componentProductId: row.componentProductId,
        quantityPerUnit: row.quantityPerUnit,
        componentStock,
        kitsAvailable: Math.max(0, kitsAvailable),
      }
    })

    out.set(productId, {
      productId,
      isVirtual: true,
      currentStock: computeVirtualStockFromComponents(detailed),
      components: detailed,
    })
  }

  return out
}

/** Expande itens de venda: kits viram saídas nos componentes. */
export function expandStockItemsThroughComponents (params: {
  items: Array<{ id?: string, product_id: string, quantity: number, unit_cost_cents?: number | null }>
  componentsByProductId: Map<string, ProductStockComponent[]>
}): Array<{
  id?: string
  product_id: string
  quantity: number
  unit_cost_cents?: number | null
  sourceItemId?: string
  kitProductId?: string
}> {
  const out: Array<{
    id?: string
    product_id: string
    quantity: number
    unit_cost_cents?: number | null
    sourceItemId?: string
    kitProductId?: string
  }> = []

  for (const item of params.items) {
    const components = params.componentsByProductId.get(item.product_id) ?? []
    const qty = Math.max(1, Math.trunc(Number(item.quantity) || 1))
    if (components.length === 0) {
      out.push(item)
      continue
    }
    for (const component of components) {
      out.push({
        id: item.id,
        product_id: component.componentProductId,
        quantity: qty * component.quantityPerUnit,
        unit_cost_cents: null,
        sourceItemId: item.id,
        kitProductId: item.product_id,
      })
    }
  }
  return out
}

export function salesOrderComponentStockExternalReference (
  orderId: string,
  itemId: string,
  componentProductId: string,
) {
  return `sales_order:${orderId}:item:${itemId}:component:${componentProductId}`
}

export function collectVirtualKitProductIds (
  componentsByProductId: Map<string, ProductStockComponent[]>,
): string[] {
  const ids: string[] = []
  for (const [productId, components] of componentsByProductId) {
    if (components.length > 0) ids.push(productId)
  }
  return ids
}

export type VirtualKitSaleOverlayInput = {
  id: string
  quantity: number
  unitCostCents: number
  salesOrderId: string
  createdAt: string
  orderNumber: number | null
}

export type VirtualKitSaleOverlayMovement = {
  id: string
  productId: string
  type: 'exit'
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: 'sales_order'
  externalReference: string
  salesOrderId: string
  salesOrderNumber: number | null
  createdAt: string
}

/** Vendas do SKU agrupador cuja baixa física foi só nos componentes. */
export function buildVirtualKitSaleHistoryOverlays (params: {
  productId: string
  postedSalesOrderIds: Iterable<string>
  items: VirtualKitSaleOverlayInput[]
}): VirtualKitSaleOverlayMovement[] {
  const posted = new Set(
    [...params.postedSalesOrderIds]
      .map((id) => String(id || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const out: VirtualKitSaleOverlayMovement[] = []
  for (const item of params.items) {
    const orderId = String(item.salesOrderId || '').trim().toLowerCase()
    if (!orderId || posted.has(orderId)) continue
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1))
    const unitValueCents = Math.max(0, Math.round(Number(item.unitCostCents) || 0))
    const itemId = String(item.id || '').trim()
    out.push({
      id: `virtual-sale:${itemId || orderId}`,
      productId: params.productId,
      type: 'exit',
      quantity,
      unitValueCents,
      totalValueCents: unitValueCents * quantity,
      source: 'sales_order',
      externalReference: `sales_order:${orderId}:item:${itemId}`,
      salesOrderId: orderId,
      salesOrderNumber: item.orderNumber,
      createdAt: String(item.createdAt || ''),
    })
  }
  return out
}

export function mergeStockMovementsByCreatedAtDesc<T extends { id: string, createdAt: string }> (
  primary: T[],
  extra: T[],
): T[] {
  return [...primary, ...extra].sort((a, b) => {
    const byDate = Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    if (Number.isFinite(byDate) && byDate !== 0) return byDate
    return String(b.id).localeCompare(String(a.id))
  })
}

export function expandServiceOrderLinesThroughComponents (params: {
  lines: Array<{
    productId: string
    quantity: number
    unitCostCents: number
    description: string
  }>
  componentsByProductId: Map<string, ProductStockComponent[]>
}): {
  lines: Array<{
    productId: string
    quantity: number
    unitCostCents: number
    description: string
  }>
  kitProductIds: Set<string>
} {
  const kitProductIds = new Set<string>()
  const merged = new Map<string, {
    productId: string
    quantity: number
    unitCostCents: number
    description: string
  }>()

  function addLine (line: {
    productId: string
    quantity: number
    unitCostCents: number
    description: string
  }) {
    const current = merged.get(line.productId)
    if (!current) {
      merged.set(line.productId, { ...line })
      return
    }
    current.quantity += line.quantity
    if (current.unitCostCents <= 0 && line.unitCostCents > 0) {
      current.unitCostCents = line.unitCostCents
    }
  }

  for (const line of params.lines) {
    const components = params.componentsByProductId.get(line.productId) ?? []
    addLine(line)
    if (components.length === 0) continue
    kitProductIds.add(line.productId)
    const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0))
    for (const component of components) {
      addLine({
        productId: component.componentProductId,
        quantity: qty * component.quantityPerUnit,
        unitCostCents: 0,
        description: line.description,
      })
    }
  }

  return {
    lines: [...merged.values()],
    kitProductIds,
  }
}
