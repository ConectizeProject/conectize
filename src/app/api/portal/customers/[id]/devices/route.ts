import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const DEVICE_FIELDS =
  'id, customer_id, device_model_id, brand, model, device_type, imei, color, notes, created_at, updated_at'

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawCustomerId } = await params
  const customerId = parseOptionalUuid(rawCustomerId)
  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: devices, error } = await auth.supabase
    .from('customer_devices')
    .select(DEVICE_FIELDS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, devices: devices ?? [] })
}

export async function POST (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawCustomerId } = await params
  const customerId = parseOptionalUuid(rawCustomerId)
  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const insertRow = {
    organization_id: auth.organizationId,
    customer_id: customerId,
    device_model_id: parseOptionalUuid(body.device_model_id),
    brand: body.brand == null ? null : String(body.brand).trim() || null,
    model: body.model == null ? null : String(body.model).trim() || null,
    device_type: body.device_type == null ? null : String(body.device_type).trim() || null,
    imei: body.imei == null ? null : String(body.imei).trim() || null,
    color: body.color == null ? null : String(body.color).trim() || null,
    notes: body.notes == null ? null : String(body.notes).trim() || null,
  }

  const { data: row, error } = await auth.supabase
    .from('customer_devices')
    .insert(insertRow)
    .select(DEVICE_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, device: row })
}
