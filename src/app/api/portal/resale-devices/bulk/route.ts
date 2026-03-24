import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

function cleanText(value: unknown): string {
  return String(value ?? '').trim()
}

function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Math.round(value)
  const s = String(value).trim().replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(s)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

function toDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  return s
}

function buildRowFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (body.device_model_id !== undefined) row.device_model_id = body.device_model_id || null
  if (body.device_name !== undefined) row.device_name = cleanText(body.device_name) || null
  if (body.model !== undefined) row.model = cleanText(body.model) || null
  if (body.color !== undefined) row.color = cleanText(body.color) || null
  if (body.storage_gb !== undefined) row.storage_gb = cleanText(body.storage_gb) || null
  if (body.battery !== undefined) row.battery = cleanText(body.battery) || null
  if (body.condition !== undefined) row.condition = cleanText(body.condition) || null
  if (body.info !== undefined) row.info = cleanText(body.info) || null
  if (body.imei !== undefined) row.imei = cleanText(body.imei) || null
  if (body.imei2 !== undefined) row.imei2 = cleanText(body.imei2) || null
  if (body.serial !== undefined) row.serial = cleanText(body.serial) || null
  if (body.purchase_value_cents !== undefined || body.purchase_value !== undefined) row.purchase_value_cents = toCents(body.purchase_value_cents ?? body.purchase_value)
  if (body.wholesale_value_cents !== undefined || body.wholesale_value !== undefined) row.wholesale_value_cents = toCents(body.wholesale_value_cents ?? body.wholesale_value)
  if (body.expected_profit_wholesale_cents !== undefined || body.expected_profit_wholesale !== undefined) row.expected_profit_wholesale_cents = toCents(body.expected_profit_wholesale_cents ?? body.expected_profit_wholesale)
  if (body.sale_value_cents !== undefined || body.sale_value !== undefined) row.sale_value_cents = toCents(body.sale_value_cents ?? body.sale_value)
  if (body.expected_profit_sale_cents !== undefined || body.expected_profit_sale !== undefined) row.expected_profit_sale_cents = toCents(body.expected_profit_sale_cents ?? body.expected_profit_sale)
  const soldForCents = body.sold_for_cents !== undefined || body.sold_for !== undefined
    ? toCents(body.sold_for_cents ?? body.sold_for)
    : null
  if (soldForCents !== null) row.sold_for_cents = soldForCents
  if (body.advertised !== undefined) row.advertised = Boolean(body.advertised)
  if (body.tested !== undefined) row.tested = Boolean(body.tested)
  if (body.label !== undefined) row.label = cleanText(body.label) || null
  if (body.sold !== undefined) row.sold = Boolean(body.sold)
  if (body.actual_profit_cents !== undefined || body.actual_profit !== undefined) {
    const val = body.actual_profit_cents ?? body.actual_profit
    row.actual_profit_cents = typeof val === 'number' ? Math.round(val) : toCents(val)
  }
  if (body.purchase_date !== undefined) row.purchase_date = toDate(body.purchase_date)
  if (body.sale_date !== undefined) row.sale_date = toDate(body.sale_date)
  return row
}

export async function PATCH(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const updates = Array.isArray(body.updates) ? body.updates : []
  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const item of updates) {
    const id = item?.id
    if (!id || typeof id !== 'string') {
      results.push({ id: String(id ?? ''), ok: false, error: 'invalid_id' })
      continue
    }

    const row = buildRowFromBody(item)
    if (Object.keys(row).length === 0) {
      results.push({ id, ok: true })
      continue
    }

    if (row.sold_for_cents != null && row.actual_profit_cents === undefined) {
      const { data: dev } = await auth.supabase.from('resale_devices').select('purchase_value_cents').eq('id', id).single()
      const { data: costs } = await auth.supabase.from('resale_device_costs').select('value_cents').eq('resale_device_id', id)
      const purchaseCents = (dev?.purchase_value_cents as number) ?? 0
      const costsTotal = (costs || []).reduce((acc: number, c: { value_cents?: number }) => acc + (c.value_cents ?? 0), 0)
      row.actual_profit_cents = (row.sold_for_cents as number) - purchaseCents - costsTotal
    }

    const { error } = await auth.supabase
      .from('resale_devices')
      .update(row)
      .eq('id', id)

    if (error) {
      results.push({ id, ok: false, error: error.message })
    } else {
      results.push({ id, ok: true })
    }
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'partial_failure',
      results,
      failed: failed.length,
    }, { status: 207 })
  }

  return NextResponse.json({ ok: true, updated: results.length, results })
}
