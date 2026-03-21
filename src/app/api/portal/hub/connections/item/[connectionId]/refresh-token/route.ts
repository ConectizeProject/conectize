import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { forceRefreshBlingToken, type HubConnection } from '@/lib/integrations/bling/api'

async function requireAdmin () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase }
}

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { connectionId } = await params
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'connection_id_required' }, { status: 400 })
  }

  const { data: row, error } = await auth.supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('id', connectionId)
    .eq('platform_id', 'bling')
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ ok: false, error: 'bling_connection_not_found' }, { status: 404 })
  }

  const result = await forceRefreshBlingToken(row as HubConnection, { supabase: auth.supabase })

  if (result.ok === false) {
    const err = result.error
    const status =
      err === 'no_refresh_token'
        ? 400
        : err === 'bling_oauth_not_configured'
          ? 500
          : 502
    return NextResponse.json({ ok: false, error: err }, { status })
  }

  return NextResponse.json({
    ok: true,
    token_expires_at: result.connection.token_expires_at,
  })
}
