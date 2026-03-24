import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

function cleanText(value: string) {
  return String(value || '').trim()
}

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const url = new URL(request.url)
  const brandId = cleanText(String(url.searchParams.get('brandId') || ''))
  const query = auth.supabase
    .from('device_types')
    .select('id, brand_id, name, device_brands ( id, name )')
    .order('name', { ascending: true })
  if (brandId) {
    query.eq('brand_id', brandId)
  }
  const { data, error } = await query
  if (error) {
    console.error('[device-types GET]', error)
    const message = process.env.NODE_ENV === 'development' ? error.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }
  const rows = (data || []).map((row: any) => ({
    id: row.id,
    brand_id: row.brand_id,
    name: row.name,
    brand_name: row.device_brands?.name ?? null,
  }))
  return NextResponse.json({ ok: true, deviceTypes: rows })
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const body = await request.json().catch(() => null)
  const brandId = (body?.brandId || body?.brand_id || '').trim()
  const name = cleanText(body?.name)
  if (!brandId || !name) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { data: inserted, error } = await auth.supabase
    .from('device_types')
    .insert({ brand_id: brandId, name })
    .select('id, brand_id, name')
    .single()
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await auth.supabase
        .from('device_types')
        .select('id, brand_id, name')
        .eq('brand_id', brandId)
        .eq('name', name)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ ok: true, deviceType: existing, existed: true })
      }
    }
    if (error.code === '23503') {
      return NextResponse.json({ ok: false, error: 'invalid_brand' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deviceType: inserted, existed: false })
}
