import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/** GET /api/portal/team-users — staff e admin (comissão, atribuições internas). */
export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: users, error } = await auth.supabase
    .from('users')
    .select('id, email, full_name, role')
    .in('role', ['admin', 'staff'])
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, users: users ?? [] })
}
