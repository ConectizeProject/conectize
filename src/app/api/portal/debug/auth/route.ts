import { NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  getAuthUser,
  getPortalAuth,
} from '@/lib/supabase/server'

export async function GET () {
  const supabase = await createSupabaseServerClient()
  const auth = await getAuthUser()
  const portalAuth = await getPortalAuth()

  if (!auth.user) {
    return NextResponse.json({
      ok: false,
      error: 'not_authenticated',
    }, { status: 401 })
  }

  const userId = auth.user.id

  const [{ data: appUser, error: appUserError }, { data: ctx, error: ctxError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_portal_context')
      .select('user_id, active_organization_id')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('organization_members')
      .select('organization_id, role_in_org')
      .eq('user_id', userId),
  ])

  return NextResponse.json({
    ok: true,
    authUser: auth.user,
    portalAuth,
    appUser: appUser ?? null,
    context: ctx ?? null,
    memberships: memberships ?? [],
    errors: {
      appUser: appUserError?.message ?? null,
      context: ctxError?.message ?? null,
      memberships: membershipsError?.message ?? null,
    },
  })
}
