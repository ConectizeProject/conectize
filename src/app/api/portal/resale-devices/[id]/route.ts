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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: device, error } = await auth.supabase
    .from('resale_devices')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !device) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: costs } = await auth.supabase
    .from('resale_device_costs')
    .select('id, description, value_cents')
    .eq('resale_device_id', id)

  return NextResponse.json({ ok: true, device: { ...device, costs: costs || [] } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

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
  if (body.advertised !== undefined) row.advertised = Boolean(body.advertised)
  if (body.tested !== undefined) row.tested = Boolean(body.tested)
  if (body.label !== undefined) row.label = cleanText(body.label) || null
  if (body.sold !== undefined) row.sold = Boolean(body.sold)
  if (body.actual_profit_cents !== undefined || body.actual_profit !== undefined) row.actual_profit_cents = toCents(body.actual_profit_cents ?? body.actual_profit)
  if (body.purchase_date !== undefined) row.purchase_date = toDate(body.purchase_date)
  if (body.sale_date !== undefined) row.sale_date = toDate(body.sale_date)

  const { data: updated, error } = await auth.supabase
    .from('resale_devices')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (Array.isArray(body.costs)) {
    await auth.supabase.from('resale_device_costs').delete().eq('resale_device_id', id)
    for (const c of body.costs) {
      const value_cents = typeof c.value_cents === 'number' ? c.value_cents : toCents(c.value ?? c.value_cents) ?? 0
      await auth.supabase.from('resale_device_costs').insert({
        resale_device_id: id,
        description: cleanText(c.description) || null,
        value_cents,
      })
    }
  }

  const { data: costs } = await auth.supabase
    .from('resale_device_costs')
    .select('id, description, value_cents')
    .eq('resale_device_id', id)

  return NextResponse.json({ ok: true, device: { ...updated, costs: costs || [] } })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('resale_devices')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
