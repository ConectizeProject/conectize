import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/** Lista usuários lojista (staff/admin) — p.ex. overrides de tag por lojista. */
export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('role', 'retailer')
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[staff/retailers GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, retailers: data || [] })
}
