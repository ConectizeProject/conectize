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

type BrandRow = {
  id: string
  name: string
  organization_id: string
}

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const orgIds = deviceCatalogOrganizationIds(auth.organizationId)
  const { data, error } = await auth.supabase
    .from('device_brands')
    .select('id, name, organization_id')
    .in('organization_id', orgIds)
    .order('name', { ascending: true })

  if (error) {
    console.error('[device-brands GET]', error)
    const message = process.env.NODE_ENV === 'development' ? error.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }

  const deviceBrands = preferHostCatalogRows((data || []) as BrandRow[], (row) => row.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))

  return NextResponse.json({
    ok: true,
    deviceBrands,
    currentOrganizationId: auth.organizationId,
  })
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const body = await request.json().catch(() => null)
  const name = cleanText(body?.name)
  if (!name) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  // Reutiliza marca do host se já existir (evita duplicar catálogo compartilhado)
  if (auth.organizationId !== CONECTIZE_HOST_ORGANIZATION_ID) {
    const { data: hostExisting } = await auth.supabase
      .from('device_brands')
      .select('id, name, organization_id')
      .eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
      .ilike('name', name)
      .maybeSingle()
    if (hostExisting?.id && cleanText(hostExisting.name).toLowerCase() === name.toLowerCase()) {
      return NextResponse.json({ ok: true, deviceBrand: hostExisting, existed: true })
    }
  }

  const { data: orgExisting } = await auth.supabase
    .from('device_brands')
    .select('id, name, organization_id')
    .eq('organization_id', auth.organizationId)
    .eq('name', name)
    .maybeSingle()
  if (orgExisting?.id) {
    return NextResponse.json({ ok: true, deviceBrand: orgExisting, existed: true })
  }

  const { data: inserted, error } = await auth.supabase
    .from('device_brands')
    .insert({ name, organization_id: auth.organizationId })
    .select('id, name, organization_id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await auth.supabase
        .from('device_brands')
        .select('id, name, organization_id')
        .eq('organization_id', auth.organizationId)
        .eq('name', name)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ ok: true, deviceBrand: existing, existed: true })
      }
    }
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deviceBrand: inserted, existed: false })
}
