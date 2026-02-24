import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

function cleanText(value: unknown): string {
  return String(value ?? '').trim()
}

function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

function toDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  return s
}

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false as const, status: 401, error: 'not_authenticated' as const }
  }
  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = appUser?.role || 'user'
  if (role !== 'admin' && role !== 'staff') {
    return { ok: false as const, status: 403, error: 'forbidden' as const }
  }
  return { ok: true as const, supabase }
}

export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: devices, error } = await auth.supabase
    .from('resale_devices')
    .select(`
      id,
      device_model_id,
      device_name,
      model,
      color,
      storage_gb,
      battery,
      condition,
      info,
      imei,
      imei2,
      serial,
      purchase_value_cents,
      wholesale_value_cents,
      expected_profit_wholesale_cents,
      sale_value_cents,
      expected_profit_sale_cents,
      advertised,
      tested,
      label,
      sold,
      actual_profit_cents,
      purchase_date,
      sale_date,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const ids = (devices || []).map((d: { id: string }) => d.id)
  let costsMap: Record<string, { id: string; description: string | null; value_cents: number }[]> = {}
  if (ids.length > 0) {
    const { data: costs } = await auth.supabase
      .from('resale_device_costs')
      .select('id, resale_device_id, description, value_cents')
      .in('resale_device_id', ids)
    for (const c of costs || []) {
      const rid = (c as { resale_device_id: string }).resale_device_id
      if (!costsMap[rid]) costsMap[rid] = []
      costsMap[rid].push({
        id: (c as { id: string }).id,
        description: (c as { description: string | null }).description ?? null,
        value_cents: (c as { value_cents: number }).value_cents ?? 0,
      })
    }
  }

  const list = (devices || []).map((d: Record<string, unknown>) => ({
    ...d,
    costs: costsMap[(d.id as string)] || [],
  }))

  return NextResponse.json({ ok: true, devices: list })
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const device_model_id = body.device_model_id || null
  const row = {
    device_model_id: device_model_id || null,
    device_name: cleanText(body.device_name) || null,
    model: cleanText(body.model) || null,
    color: cleanText(body.color) || null,
    storage_gb: cleanText(body.storage_gb) || null,
    battery: cleanText(body.battery) || null,
    condition: cleanText(body.condition) || null,
    info: cleanText(body.info) || null,
    imei: cleanText(body.imei) || null,
    imei2: cleanText(body.imei2) || null,
    serial: cleanText(body.serial) || null,
    purchase_value_cents: toCents(body.purchase_value_cents ?? body.purchase_value),
    wholesale_value_cents: toCents(body.wholesale_value_cents ?? body.wholesale_value),
    expected_profit_wholesale_cents: toCents(body.expected_profit_wholesale_cents ?? body.expected_profit_wholesale),
    sale_value_cents: toCents(body.sale_value_cents ?? body.sale_value),
    expected_profit_sale_cents: toCents(body.expected_profit_sale_cents ?? body.expected_profit_sale),
    advertised: Boolean(body.advertised),
    tested: Boolean(body.tested),
    label: cleanText(body.label) || null,
    sold: Boolean(body.sold),
    actual_profit_cents: toCents(body.actual_profit_cents ?? body.actual_profit),
    purchase_date: toDate(body.purchase_date),
    sale_date: toDate(body.sale_date),
  }

  const { data: inserted, error } = await auth.supabase
    .from('resale_devices')
    .insert(row)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const costs = Array.isArray(body.costs) ? body.costs : []
  for (const c of costs) {
    const value_cents = typeof c.value_cents === 'number' ? c.value_cents : toCents(c.value ?? c.value_cents) ?? 0
    await auth.supabase.from('resale_device_costs').insert({
      resale_device_id: inserted.id,
      description: cleanText(c.description) || null,
      value_cents,
    })
  }

  const { data: costsData } = await auth.supabase
    .from('resale_device_costs')
    .select('id, description, value_cents')
    .eq('resale_device_id', inserted.id)

  return NextResponse.json({
    ok: true,
    device: { ...inserted, costs: costsData || [] },
  })
}
