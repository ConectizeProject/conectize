import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

export type Product = {
  id: string
  blingId: string | null
  kind?: 'product' | 'service' | null
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  imageUrl?: string | null
  salePriceCents: number | null
  costPriceCents: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateProductInput = {
  blingId?: string | null
  kind?: 'product' | 'service' | null
  name: string
  sku?: string | null
  barcode?: string | null
  description?: string | null
  salePriceCents?: number | null
  costPriceCents?: number | null
  isActive?: boolean
}

export type UpdateProductInput = Partial<CreateProductInput>

export type StockMovementType = 'entry' | 'exit' | 'loss'

export type StockMovement = {
  id: string
  productId: string
  type: StockMovementType
  quantity: number
  unitValueCents: number
  totalValueCents: number
  source: 'manual' | 'bling' | 'system'
  externalReference: string | null
  createdAt: string
}

export type AddStockMovementInput = {
  type: StockMovementType
  quantity: number
  unitValueCents?: number | null
  source?: 'manual' | 'bling' | 'system'
  externalReference?: string | null
}

async function requireAuth () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false as const, error: 'not_authenticated' as const }
  }
  return { ok: true as const, supabase, userId: user.id }
}

function normalizeMoney (value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num)
}

export async function createProduct (input: CreateProductInput) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const name = String(input.name || '').trim()
  if (!name) {
    return { ok: false as const, error: 'name_required' as const }
  }

  const payload = {
    bling_id: input.blingId ?? null,
    name,
    sku: input.sku ? String(input.sku).trim() : null,
    barcode: input.barcode ? String(input.barcode).trim() : null,
    description: input.description ? String(input.description).trim() : null,
    sale_price_cents: normalizeMoney(input.salePriceCents),
    cost_price_cents: normalizeMoney(input.costPriceCents),
    is_active: input.isActive ?? true,
    created_by: auth.userId,
  }

  const { data, error } = await auth.supabase
    .from('products')
    .insert(payload)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const, product: mapRowToProduct(data) }
}

export async function updateProduct (id: string, input: UpdateProductInput) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const patch: Record<string, unknown> = {}

  if (input.blingId !== undefined) patch.bling_id = input.blingId
  if (input.kind !== undefined) patch.kind = input.kind
  if (input.name !== undefined) patch.name = String(input.name || '').trim()
  if (input.sku !== undefined) patch.sku = input.sku ? String(input.sku).trim() : null
  if (input.barcode !== undefined) patch.barcode = input.barcode ? String(input.barcode).trim() : null
  if (input.description !== undefined) {
    patch.description = input.description ? String(input.description).trim() : null
  }
  if (input.salePriceCents !== undefined) {
    patch.sale_price_cents = normalizeMoney(input.salePriceCents)
  }
  if (input.costPriceCents !== undefined) {
    patch.cost_price_cents = normalizeMoney(input.costPriceCents)
  }
  if (input.isActive !== undefined) patch.is_active = Boolean(input.isActive)

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, error: 'nothing_to_update' as const }
  }

  patch.updated_at = new Date().toISOString()

  const { data, error } = await auth.supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const, product: mapRowToProduct(data) }
}

export async function deleteProduct (id: string) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const { error } = await auth.supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function getProductById (id: string) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: 'not_found' as const }
  }

  return { ok: true as const, product: mapRowToProduct(data) }
}

export async function listProducts (params: { search?: string; active?: boolean | null; limit?: number; offset?: number } = {}) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  let query = auth.supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.search) {
    const term = `%${params.search.trim()}%`
    query = query.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`)
  }

  if (params.active !== null && params.active !== undefined) {
    query = query.eq('is_active', params.active)
  }

  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20
  const offset = params.offset && params.offset > 0 ? params.offset : 0

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error || !data) {
    return { ok: false as const, error: 'db_error' as const }
  }

  return {
    ok: true as const,
    items: data.map(mapRowToProduct),
    total: count ?? data.length,
  }
}

export async function addStockMovement (productId: string, input: AddStockMovementInput) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false as const, error: 'quantity_invalid' as const }
  }

  const type: StockMovementType = input.type
  if (!['entry', 'exit', 'loss'].includes(type)) {
    return { ok: false as const, error: 'type_invalid' as const }
  }

  const unitValueCents = normalizeMoney(input.unitValueCents ?? 0) ?? 0
  const totalValueCents = unitValueCents * quantity

  const { data: inserted, error } = await auth.supabase
    .from('product_stock_movements')
    .insert({
      product_id: productId,
      type,
      quantity,
      unit_value_cents: unitValueCents,
      total_value_cents: totalValueCents,
      source: input.source || 'manual',
      external_reference: input.externalReference ?? null,
      created_by: auth.userId,
    })
    .select('*')
    .maybeSingle()

  if (error || !inserted) {
    return { ok: false as const, error: 'db_error' as const }
  }

  const movement = mapRowToMovement(inserted)
  const currentStock = await getProductCurrentStock(productId)

  return {
    ok: true as const,
    movement,
    currentStock: currentStock.ok ? currentStock.currentStock : null,
  }
}

export async function listStockMovements (productId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('product_stock_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return { ok: false as const, error: 'db_error' as const }
  }

  return {
    ok: true as const,
    items: data.map(mapRowToMovement),
  }
}

export async function getProductCurrentStock (productId: string) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('product_stock_movements')
    .select('type, quantity')
    .eq('product_id', productId)

  if (error || !data) {
    return { ok: false as const, error: 'db_error' as const }
  }

  let balance = 0
  for (const row of data) {
    const type = (row as { type: StockMovementType }).type
    const quantity = Number((row as { quantity: number }).quantity) || 0
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (type === 'entry') balance += quantity
    else if (type === 'exit' || type === 'loss') balance -= quantity
  }

  return { ok: true as const, currentStock: balance }
}

export async function getProductWithStock (id: string) {
  const [productRes, stockRes] = await Promise.all([getProductById(id), getProductCurrentStock(id)])
  if (!productRes.ok) return productRes
  if (!stockRes.ok) return stockRes

  return {
    ok: true as const,
    product: productRes.product,
    currentStock: stockRes.currentStock,
  }
}

function mapRowToProduct (row: any): Product {
  return {
    id: String(row.id),
    blingId: row.bling_id ? String(row.bling_id) : null,
    kind: row.kind === 'product' || row.kind === 'service' ? row.kind : null,
    name: String(row.name || '').trim(),
    sku: row.sku ? String(row.sku).trim() : null,
    barcode: row.barcode ? String(row.barcode).trim() : null,
    description: row.description ? String(row.description).trim() : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    salePriceCents: typeof row.sale_price_cents === 'number' ? row.sale_price_cents : null,
    costPriceCents: typeof row.cost_price_cents === 'number' ? row.cost_price_cents : null,
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }
}

function mapRowToMovement (row: any): StockMovement {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    type: row.type,
    quantity: Number(row.quantity) || 0,
    unitValueCents: Number(row.unit_value_cents) || 0,
    totalValueCents: Number(row.total_value_cents) || 0,
    source: row.source || 'manual',
    externalReference: row.external_reference ? String(row.external_reference) : null,
    createdAt: row.created_at || '',
  }
}

