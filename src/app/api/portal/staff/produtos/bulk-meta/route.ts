import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { resolveListDisplayCostCents } from '@/lib/products/list-display-cost'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StockRpcRow = {
  product_id: string
  last_entry_unit_value_cents?: number | null
  last_entry_created_at?: string | null
  has_movements?: boolean | null
}

export async function POST (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { productIds?: unknown } | null
  const raw = body?.productIds
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: 'productIds_invalid' }, { status: 400 })
  }

  const ids = [
    ...new Set(
      raw
        .map((x) => String(x || '').trim().toLowerCase())
        .filter((x) => UUID_RE.test(x)),
    ),
  ].slice(0, 200)

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'productIds_empty' }, { status: 400 })
  }

  const { data: prodRows, error: pErr } = await auth.supabase
    .from('products')
    .select(
      'id, name, kind, sale_price_cents, cost_price_cents, cost_price_manual_edited_at, pricing_tag_id',
    )
    .in('id', ids)

  if (pErr) {
    console.error('[staff/produtos/bulk-meta products]', pErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const { data: stockRpcRows, error: stockErr } = await auth.supabase.rpc(
    'portal_products_list_stock_summary',
    { p_product_ids: ids },
  )

  const stockByProduct = new Map<
    string,
    { lastCents: number | null; lastMs: number | null }
  >()

  if (!stockErr && stockRpcRows && Array.isArray(stockRpcRows)) {
    for (const row of stockRpcRows as StockRpcRow[]) {
      const pid = String(row.product_id)
      const cents = row.last_entry_unit_value_cents
      const createdAt = row.last_entry_created_at
      stockByProduct.set(pid, {
        lastCents: typeof cents === 'number' ? cents : null,
        lastMs: createdAt ? new Date(String(createdAt)).getTime() : null,
      })
    }
  }

  const { data: compatRows, error: cErr } = await auth.supabase
    .from('product_compatible_device_models')
    .select('product_id, device_model_id')
    .in('product_id', ids)

  if (cErr) {
    console.error('[staff/produtos/bulk-meta compat]', cErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const compatByProduct = new Map<string, string[]>()
  for (const r of compatRows ?? []) {
    const row = r as { product_id: string; device_model_id: string }
    const pid = String(row.product_id)
    const mid = String(row.device_model_id)
    if (!compatByProduct.has(pid)) compatByProduct.set(pid, [])
    compatByProduct.get(pid)!.push(mid)
  }

  type PRow = {
    id: string
    name: string
    kind?: string | null
    sale_price_cents?: number | null
    cost_price_cents?: number | null
    cost_price_manual_edited_at?: string | null
    pricing_tag_id?: string | null
  }

  const rowById = new Map<string, PRow>()
  for (const r of prodRows ?? []) {
    const row = r as PRow
    rowById.set(String(row.id), row)
  }

  const items = ids.map((id) => {
    const row = rowById.get(id)
    if (!row) {
      return { id, missing: true as const }
    }
    const st = stockByProduct.get(id)
    const costPriceCents = resolveListDisplayCostCents({
      costPriceCents: row.cost_price_cents,
      costPriceManualEditedAt: row.cost_price_manual_edited_at,
      lastEntryUnitValueCents: st?.lastCents ?? null,
      lastEntryTimeMs: st?.lastMs ?? null,
    })
    return {
      id,
      name: row.name,
      kind: row.kind ?? null,
      salePriceCents: typeof row.sale_price_cents === 'number' ? row.sale_price_cents : null,
      costPriceCents,
      pricingTagId: row.pricing_tag_id != null ? String(row.pricing_tag_id) : null,
      deviceModelIds: compatByProduct.get(id) ?? [],
      missing: false as const,
    }
  })

  return NextResponse.json({ ok: true, items })
}
