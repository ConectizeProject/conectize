import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function cleanText(value: string) {
  return String(value || '').trim()
}

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
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
  const brand = cleanText(String(url.searchParams.get('brand') || ''))
  const deviceType = cleanText(String(url.searchParams.get('deviceType') || ''))
  const q = cleanText(String(url.searchParams.get('q') || ''))

  let limit = Number.parseInt(String(url.searchParams.get('limit') || '500'), 10)
  if (Number.isNaN(limit) || limit < 1) limit = 500
  limit = Math.min(limit, 2000)

  const query = auth.supabase
    .from('device_models')
    .select('id, brand, device_type, model, created_at')
    .order('brand', { ascending: true })
    .order('device_type', { ascending: true })
    .order('model', { ascending: true })
    .limit(limit)

  if (brand) query.eq('brand', brand)
  if (deviceType) query.eq('device_type', deviceType)
  if (q) query.ilike('model', `%${q}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deviceModels: data || [] })
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const brand = cleanText(body?.brand)
  const deviceType = cleanText(body?.deviceType)
  const model = cleanText(body?.model)

  if (!brand || !deviceType || !model) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from('device_models')
    .select('id, brand, device_type, model')
    .eq('brand', brand)
    .eq('device_type', deviceType)
    .eq('model', model)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({ ok: true, deviceModel: existing, existed: true })
  }

  const { data: inserted, error } = await auth.supabase
    .from('device_models')
    .insert({
      brand,
      device_type: deviceType,
      model,
    })
    .select('id, brand, device_type, model')
    .single()

  if (error) {
    const { data: after } = await auth.supabase
      .from('device_models')
      .select('id, brand, device_type, model')
      .eq('brand', brand)
      .eq('device_type', deviceType)
      .eq('model', model)
      .maybeSingle()

    if (after?.id) {
      return NextResponse.json({ ok: true, deviceModel: after, existed: true })
    }

    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deviceModel: inserted, existed: false })
}

