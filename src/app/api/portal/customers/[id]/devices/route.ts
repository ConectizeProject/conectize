import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }
  const { data: appUser } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') return { ok: false as const, status: 403, error: 'forbidden' }
  return { ok: true as const, supabase }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id: customerId } = await params
  if (!customerId) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { data: devices, error } = await auth.supabase
    .from('customer_devices')
    .select('id, customer_id, device_model_id, brand, model, device_type, imei, color, notes, created_at, updated_at, device_models ( id, model, device_types ( name, device_brands ( name ) ) )')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[portal/customers/devices] list error:', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const list = (devices ?? []).map((d: any) => {
    const dm = Array.isArray(d.device_models) ? d.device_models[0] : d.device_models
    const dt = dm?.device_types || null
    const brandRow = dt?.device_brands || null
    return {
      id: d.id,
      customer_id: d.customer_id,
      device_model_id: d.device_model_id,
      brand: d.brand ?? brandRow?.name ?? null,
      model: d.model ?? dm?.model ?? null,
      device_type: d.device_type ?? dt?.name ?? null,
      imei: d.imei,
      color: d.color,
      notes: d.notes,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }
  })

  return NextResponse.json({ ok: true, devices: list })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id: customerId } = await params
  if (!customerId) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const deviceModelId = body?.device_model_id ? String(body.device_model_id).trim() : null
  const brand = body?.brand != null ? String(body.brand).trim() : null
  const model = body?.model != null ? String(body.model).trim() : null
  const deviceType = body?.device_type != null ? String(body.device_type).trim() : null
  const imei = body?.imei != null ? String(body.imei).trim() : null
  const color = body?.color != null ? String(body.color).trim() : null
  const notes = body?.notes != null ? String(body.notes).trim() : null

  const { data: inserted, error } = await auth.supabase
    .from('customer_devices')
    .insert({
      customer_id: customerId,
      device_model_id: deviceModelId || null,
      brand: brand || null,
      model: model || null,
      device_type: deviceType || null,
      imei: imei || null,
      color: color || null,
      notes: notes || null,
    })
    .select('id, customer_id, device_model_id, brand, model, device_type, imei, color, notes, created_at, updated_at')
    .single()

  if (error) {
    console.error('[portal/customers/devices] create error:', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, device: inserted })
}
