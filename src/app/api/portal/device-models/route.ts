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

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const deviceTypeId = cleanText(String(url.searchParams.get('device_type_id') || url.searchParams.get('deviceTypeId') || ''))
  const q = cleanText(String(url.searchParams.get('q') || ''))

  let limit = Number.parseInt(String(url.searchParams.get('limit') || '500'), 10)
  if (Number.isNaN(limit) || limit < 1) limit = 500
  limit = Math.min(limit, 2000)

  const query = auth.supabase
    .from('device_models')
    .select('id, model, device_type_id, device_types ( id, name, device_brands ( id, name ) )')
    .order('model', { ascending: true })
    .limit(limit)

  if (deviceTypeId) query.eq('device_type_id', deviceTypeId)
  if (q) query.ilike('model', `%${q}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const rows = (data || []).map((row: any) => {
    const dt = row.device_types
    const brand = dt?.device_brands
    return {
      id: row.id,
      model: row.model,
      device_type_id: row.device_type_id,
      brand: brand?.name ?? null,
      device_type: dt?.name ?? null,
    }
  })

  const res = NextResponse.json({ ok: true, deviceModels: rows })
  res.headers.set('Cache-Control', 'private, max-age=300')
  return res
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const deviceTypeId = (body?.device_type_id ?? body?.deviceTypeId ?? '').trim()
  const model = cleanText(body?.model)

  if (!deviceTypeId || !model) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const { data: typeRow } = await auth.supabase
    .from('device_types')
    .select('id, name, device_brands ( id, name )')
    .eq('id', deviceTypeId)
    .maybeSingle()
  const brandName = (typeRow as any)?.device_brands?.name ?? ''
  const deviceTypeName = (typeRow as any)?.name ?? ''
  if (!brandName || !deviceTypeName) {
    return NextResponse.json({ ok: false, error: 'invalid_device_type' }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from('device_models')
    .select('id, model, device_type_id')
    .eq('device_type_id', deviceTypeId)
    .eq('model', model)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({
      ok: true,
      deviceModel: { id: existing.id, model: existing.model, device_type_id: existing.device_type_id, brand: brandName, device_type: deviceTypeName },
      existed: true,
    })
  }

  const { data: inserted, error } = await auth.supabase
    .from('device_models')
    .insert({
      device_type_id: deviceTypeId,
      model,
    })
    .select('id, model, device_type_id')
    .single()

  if (error) {
    const { data: after } = await auth.supabase
      .from('device_models')
      .select('id, model, device_type_id')
      .eq('device_type_id', deviceTypeId)
      .eq('model', model)
      .maybeSingle()
    if (after?.id) {
      return NextResponse.json({
        ok: true,
        deviceModel: { id: after.id, model: after.model, device_type_id: after.device_type_id, brand: brandName, device_type: deviceTypeName },
        existed: true,
      })
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deviceModel: { id: inserted.id, model: inserted.model, device_type_id: inserted.device_type_id, brand: brandName, device_type: deviceTypeName },
    existed: false,
  })
}

