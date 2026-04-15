import { NextRequest, NextResponse } from 'next/server'
import { requireRetailer } from '@/lib/auth/portal-api'

function parseUuidParam (raw: string | null): string | null {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) return null
  return v
}

/**
 * Cascata marca → tipo → modelo para filtros do catálogo comercial (RLS lojista em `device_*`).
 */
export async function GET (request: NextRequest) {
  const auth = await requireRetailer()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const brandId = parseUuidParam(url.searchParams.get('brandId'))
  const deviceTypeId = parseUuidParam(url.searchParams.get('deviceTypeId'))

  const { data: deviceBrands, error: bErr } = await auth.supabase
    .from('device_brands')
    .select('id, name')
    .order('name', { ascending: true })

  if (bErr) {
    console.error('[lojista/device-filters brands]', bErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!brandId) {
    return NextResponse.json({ ok: true, deviceBrands: deviceBrands || [] })
  }

  const { data: deviceTypes, error: tErr } = await auth.supabase
    .from('device_types')
    .select('id, brand_id, name')
    .eq('brand_id', brandId)
    .order('name', { ascending: true })

  if (tErr) {
    console.error('[lojista/device-filters types]', tErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!deviceTypeId) {
    return NextResponse.json({
      ok: true,
      deviceBrands: deviceBrands || [],
      deviceTypes: deviceTypes || [],
    })
  }

  const { data: deviceModels, error: mErr } = await auth.supabase
    .from('device_models')
    .select('id, model, device_type_id')
    .eq('device_type_id', deviceTypeId)
    .order('model', { ascending: true })
    .limit(2000)

  if (mErr) {
    console.error('[lojista/device-filters models]', mErr)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    deviceBrands: deviceBrands || [],
    deviceTypes: deviceTypes || [],
    deviceModels: deviceModels || [],
  })
}
