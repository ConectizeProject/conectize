import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { effectiveSearchTokens } from '@/lib/products/product-search'

export async function GET (request: Request) {
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const kindParam = String(searchParams.get('kind') || '').trim()
  const kind = kindParam === 'service' ? 'service' : kindParam === 'product' ? 'product' : null
  const q = String(searchParams.get('q') || '').trim()
  const tokens = effectiveSearchTokens(q)

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('products')
    .select('id, name, sku, barcode, kind, sale_price_cents, cost_price_cents, is_active, parent_bling_id')
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
  }
  const items = (data ?? []).map((row: ProductRow) => ({
    id: String(row.id),
    name: String(row.name || '').trim(),
    sku: row.sku ? String(row.sku) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    kind: row.kind === 'service' ? 'service' : 'product',
    salePriceCents: typeof row.sale_price_cents === 'number' ? row.sale_price_cents : 0,
    costPriceCents: typeof row.cost_price_cents === 'number' ? row.cost_price_cents : 0,
  }))

  return NextResponse.json({ ok: true, items })
}

