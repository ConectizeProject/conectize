import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import {
  deviceCatalogOrganizationIds,
  preferHostCatalogRows,
} from '@/lib/organizations/device-catalog'

function cleanText (value: string) {
  return String(value || '').trim()
}

type TypeDbRow = {
  id: string
  brand_id?: string | null
  name?: string | null
  organization_id?: string | null
  device_brands?: { name?: string | null } | { name?: string | null }[] | null
}

export async function GET (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const url = new URL(request.url)
  const brandId = cleanText(String(url.searchParams.get('brandId') || ''))
  const orgIds = deviceCatalogOrganizationIds(auth.organizationId)

  let query = auth.supabase
    .from('device_types')
    .select('id, brand_id, name, organization_id, device_brands ( id, name )')
    .in('organization_id', orgIds)
    .order('name', { ascending: true })

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[device-types GET]', error)
    const message = process.env.NODE_ENV === 'development' ? error.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }

  const mapped = ((data || []) as TypeDbRow[]).map((row) => {
    const b = row.device_brands
    const brandName = Array.isArray(b) ? b[0]?.name : b?.name
    return {
      id: row.id,
      brand_id: row.brand_id,
      name: row.name,
      organization_id: row.organization_id,
      brand_name: brandName ?? null,
    }
  })

  const deviceTypes = preferHostCatalogRows(
    mapped,
    (row) => `${row.brand_id || ''}::${row.name || ''}`,
  ).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }))

  return NextResponse.json({
    ok: true,
    deviceTypes,
    currentOrganizationId: auth.organizationId,
  })
}

export async function POST (request: Request) {
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

  const orgIds = deviceCatalogOrganizationIds(auth.organizationId)
  const { data: brandRow } = await auth.supabase
    .from('device_brands')
    .select('id')
    .eq('id', brandId)
    .in('organization_id', orgIds)
    .maybeSingle()
  if (!brandRow) {
    return NextResponse.json({ ok: false, error: 'invalid_brand' }, { status: 400 })
  }

  // Reutiliza tipo do host sob a mesma marca
  if (auth.organizationId !== CONECTIZE_HOST_ORGANIZATION_ID) {
    const { data: hostExisting } = await auth.supabase
      .from('device_types')
      .select('id, brand_id, name, organization_id')
      .eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
      .eq('brand_id', brandId)
      .eq('name', name)
      .maybeSingle()
    if (hostExisting?.id) {
      return NextResponse.json({ ok: true, deviceType: hostExisting, existed: true })
    }
  }

  const { data: orgExisting } = await auth.supabase
    .from('device_types')
    .select('id, brand_id, name, organization_id')
    .eq('organization_id', auth.organizationId)
    .eq('brand_id', brandId)
    .eq('name', name)
    .maybeSingle()
  if (orgExisting?.id) {
    return NextResponse.json({ ok: true, deviceType: orgExisting, existed: true })
  }

  const { data: inserted, error } = await auth.supabase
    .from('device_types')
    .insert({ brand_id: brandId, name, organization_id: auth.organizationId })
    .select('id, brand_id, name, organization_id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await auth.supabase
        .from('device_types')
        .select('id, brand_id, name, organization_id')
        .eq('organization_id', auth.organizationId)
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
