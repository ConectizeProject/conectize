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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id: customerId, deviceId } = await params
  if (!customerId || !deviceId) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (body?.device_model_id !== undefined) updates.device_model_id = body.device_model_id ? String(body.device_model_id).trim() : null
  if (body?.brand !== undefined) updates.brand = body.brand != null ? String(body.brand).trim() : null
  if (body?.model !== undefined) updates.model = body.model != null ? String(body.model).trim() : null
  if (body?.device_type !== undefined) updates.device_type = body.device_type != null ? String(body.device_type).trim() : null
  if (body?.imei !== undefined) updates.imei = body.imei != null ? String(body.imei).trim() : null
  if (body?.color !== undefined) updates.color = body.color != null ? String(body.color).trim() : null
  if (body?.notes !== undefined) updates.notes = body.notes != null ? String(body.notes).trim() : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_updates' }, { status: 400 })
  }

  const { data: updated, error } = await auth.supabase
    .from('customer_devices')
    .update(updates)
    .eq('id', deviceId)
    .eq('customer_id', customerId)
    .select('id, customer_id, device_model_id, brand, model, device_type, imei, color, notes, created_at, updated_at')
    .single()

  if (error) {
    console.error('[portal/customers/devices] update error:', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true, device: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id: customerId, deviceId } = await params
  if (!customerId || !deviceId) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('customer_devices')
    .delete()
    .eq('id', deviceId)
    .eq('customer_id', customerId)

  if (error) {
    console.error('[portal/customers/devices] delete error:', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
