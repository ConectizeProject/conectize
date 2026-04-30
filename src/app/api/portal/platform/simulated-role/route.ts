import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  PORTAL_SIMULATED_ROLE_COOKIE,
  isPortalSimulatableRole,
} from '@/lib/auth/portal-role-simulation'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function POST (request: Request) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'platform_admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const role = String(body?.role || '').trim()
  const response = NextResponse.json({ ok: true })

  if (!role || role === 'platform_admin') {
    response.cookies.delete(PORTAL_SIMULATED_ROLE_COOKIE)
    return response
  }

  if (!isPortalSimulatableRole(role)) {
    return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 })
  }

  response.cookies.set(PORTAL_SIMULATED_ROLE_COOKIE, role, COOKIE_OPTIONS)
  return response
}
