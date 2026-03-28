import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const DEVICE_FIELDS =
  'id, customer_id, device_model_id, brand, model, device_type, imei, color, notes, created_at, updated_at'

export async function PATCH (
  request: Request,
  { params }: { params: Promise<{ id: string; deviceId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawCustomerId, deviceId: rawDeviceId } = await params
  const customerId = parseOptionalUuid(rawCustomerId)
  const deviceId = parseOptionalUuid(rawDeviceId)
  if (!customerId || !deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ('brand' in body) {
    patch.brand = body.brand == null ? null : String(body.brand).trim() || null
  }
  if ('model' in body) {
    patch.model = body.model == null ? null : String(body.model).trim() || null
  }
  if ('device_type' in body) {
    patch.device_type = body.device_type == null ? null : String(body.device_type).trim() || null
  }
  if ('imei' in body) {
    patch.imei = body.imei == null ? null : String(body.imei).trim() || null
  }
  if ('color' in body) {
    patch.color = body.color == null ? null : String(body.color).trim() || null
  }
  if ('notes' in body) {
    patch.notes = body.notes == null ? null : String(body.notes).trim() || null
  }
  if ('device_model_id' in body) {
    patch.device_model_id = parseOptionalUuid(body.device_model_id)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data: rows, error } = await auth.supabase
    .from('customer_devices')
    .update(patch)
    .eq('id', deviceId)
    .eq('customer_id', customerId)
    .select(DEVICE_FIELDS)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, device: rows[0] })
}

export async function DELETE (
  _request: Request,
  { params }: { params: Promise<{ id: string; deviceId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawCustomerId, deviceId: rawDeviceId } = await params
  const customerId = parseOptionalUuid(rawCustomerId)
  const deviceId = parseOptionalUuid(rawDeviceId)
  if (!customerId || !deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('customer_devices')
    .delete()
    .eq('id', deviceId)
    .eq('customer_id', customerId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
