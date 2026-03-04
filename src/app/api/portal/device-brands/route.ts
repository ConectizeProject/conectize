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

export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { data, error } = await auth.supabase
    .from('device_brands')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) {
    console.error('[device-brands GET]', error)
    const message = process.env.NODE_ENV === 'development' ? error.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deviceBrands: data || [] })
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const body = await request.json().catch(() => null)
  const name = cleanText(body?.name)
  if (!name) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { data: inserted, error } = await auth.supabase
    .from('device_brands')
    .insert({ name })
    .select('id, name')
    .single()
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await auth.supabase
        .from('device_brands')
        .select('id, name')
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
