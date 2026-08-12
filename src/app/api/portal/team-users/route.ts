import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

/** GET /api/portal/team-users — staff e admin da organização ativa (comissão, atribuições internas). */
export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: members, error: membersError } = await auth.supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', auth.organizationId)
    .in('role_in_org', ['admin', 'staff'])

  if (membersError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const memberIds = [...new Set((members ?? []).map((m) => m.user_id).filter(Boolean))]
  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, users: [] })
  }

  const { data: users, error } = await auth.supabase
    .from('users')
    .select('id, email, full_name, role')
    .in('id', memberIds)
    .in('role', ['admin', 'staff'])
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, users: users ?? [] })
}
