import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

function cleanText(value: string) {
  return String(value || '').trim()
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
  const brandId = (body?.brandId || body?.brand_id || '').trim()
  const name = cleanText(body?.name)
  if (!brandId || !name) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { data: current } = await auth.supabase
    .from('device_types')
    .select('name')
    .eq('id', id)
    .maybeSingle()
  const oldName = current?.name ?? ''

  const { data: updated, error } = await auth.supabase
    .from('device_types')
    .update({ brand_id: brandId, name })
    .eq('id', id)
    .select('id, brand_id, name')
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'duplicate' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  // Manter device_models.device_type em sync para não perder vínculo na listagem (que filtra por nome)
  await auth.supabase.from('device_models').update({ device_type: name }).eq('device_type_id', id)
  // Aparelhos vinculados só por texto (brand + device_type, sem device_type_id)
  if (oldName) {
    const { data: brandRow } = await auth.supabase.from('device_brands').select('name').eq('id', brandId).maybeSingle()
    if (brandRow?.name) {
      await auth.supabase
        .from('device_models')
        .update({ device_type: name })
        .eq('brand', brandRow.name)
        .eq('device_type', oldName)
    }
  }
  return NextResponse.json({ ok: true, deviceType: updated })
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
    .from('device_types')
    .delete()
    .eq('id', id)
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { ok: false, error: 'in_use', message: 'Este dispositivo está em uso em aparelhos.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
