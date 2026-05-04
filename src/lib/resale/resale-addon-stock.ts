import type { SupabaseClient } from '@supabase/supabase-js'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export type AddonInventoryLineInput = {
  product_id: string
  quantity: number
}

export function parseAddonInventoryLines (
  body: Record<string, unknown>,
): AddonInventoryLineInput[] {
  const raw = body.addon_inventory_lines
  if (!Array.isArray(raw)) return []
  const out: AddonInventoryLineInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const pid = parseOptionalUuid(o.product_id)
    const qty = Math.round(Number(o.quantity))
    if (!pid || !Number.isFinite(qty) || qty <= 0) continue
    out.push({ product_id: pid, quantity: qty })
  }
  return mergeAddonInventoryLines(out)
}

export function mergeAddonInventoryLines (
  lines: AddonInventoryLineInput[],
): AddonInventoryLineInput[] {
  const m = new Map<string, number>()
  for (const l of lines) {
    m.set(l.product_id, (m.get(l.product_id) ?? 0) + l.quantity)
  }
  return [...m.entries()].map(([product_id, quantity]) => ({ product_id, quantity }))
}

export async function validateAddonStockAvailable (
  supabase: SupabaseClient,
  lines: AddonInventoryLineInput[],
): Promise<
  | { ok: true }
  | {
      ok: false
      reason: 'stock_unavailable'
      productId: string
      requested: number
      available: number
    }
  | { ok: false; reason: 'db_error' }
> {
  if (lines.length === 0) return { ok: true }
  const ids = lines.map((l) => l.product_id)
  const { data, error } = await supabase.rpc('portal_products_list_stock_summary', {
    p_product_ids: ids,
  })
  if (error) return { ok: false, reason: 'db_error' }

  const stockById = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ product_id: string; current_stock: number | string }>) {
    const raw = row.current_stock
    const stock = typeof raw === 'number' ? raw : Number(raw)
    stockById.set(String(row.product_id), Number.isFinite(stock) ? stock : 0)
  }

  for (const line of lines) {
    const avail = stockById.get(line.product_id) ?? 0
    if (avail < line.quantity) {
      return {
        ok: false,
        reason: 'stock_unavailable',
        productId: line.product_id,
        requested: line.quantity,
        available: avail,
      }
    }
  }
  return { ok: true }
}

export async function insertStockExitsForResaleAddons (params: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  deviceId: string
  lines: AddonInventoryLineInput[]
}): Promise<{ ok: true } | { ok: false; error: 'db_error' }> {
  const { supabase, organizationId, userId, deviceId, lines } = params
  if (lines.length === 0) return { ok: true }

  const ids = lines.map((l) => l.product_id)
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, cost_price_cents')
    .eq('organization_id', organizationId)
    .in('id', ids)

  if (pErr) return { ok: false, error: 'db_error' }

  const costById = new Map<string, number>()
  for (const p of products ?? []) {
    const row = p as { id: string; cost_price_cents?: number | null }
    const c = row.cost_price_cents
    costById.set(String(row.id), typeof c === 'number' && Number.isFinite(c) ? Math.max(0, c) : 0)
  }

  for (const line of lines) {
    const unitCost = costById.get(line.product_id) ?? 0
    const uniq =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const ref = `resale_device_sale:${deviceId}:${line.product_id}:${uniq}`
    const { error: movError } = await supabase.from('product_stock_movements').insert({
      organization_id: organizationId,
      product_id: line.product_id,
      type: 'exit',
      quantity: line.quantity,
      unit_value_cents: unitCost,
      total_value_cents: unitCost * line.quantity,
      source: 'resale_device_sale',
      external_reference: ref,
      created_by: userId,
    })
    if (movError) {
      console.error('[resale-addon-stock]', movError)
      return { ok: false, error: 'db_error' }
    }
  }

  return { ok: true }
}
