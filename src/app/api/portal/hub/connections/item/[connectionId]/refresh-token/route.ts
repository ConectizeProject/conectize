import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { forceRefreshBlingToken, type HubConnection } from '@/lib/integrations/bling/api'
import {
  blingRefreshTokenErrorCode,
  blingRefreshTokenErrorToMessage,
} from '@/lib/integrations/bling/refresh-token-errors'

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
        message: blingRefreshTokenErrorToMessage(auth.error),
      },
      { status: auth.status }
    )
  }

  const { connectionId } = await params
  if (!connectionId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'connection_id_required',
        message: blingRefreshTokenErrorToMessage('connection_id_required'),
      },
      { status: 400 }
    )
  }

  const { data: row, error } = await auth.supabase
    .from('hub_connections')
    .select('id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by')
    .eq('id', connectionId)
    .eq('platform_id', 'bling')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json(
      {
        ok: false,
        error: 'bling_connection_not_found',
        message: blingRefreshTokenErrorToMessage('bling_connection_not_found'),
      },
      { status: 404 }
    )
  }

  const result = await forceRefreshBlingToken(row as HubConnection, {
    supabase: auth.supabase,
  })

  if (result.ok === false) {
    const code = blingRefreshTokenErrorCode(result.error)
    const message = blingRefreshTokenErrorToMessage(result.error)
    const status =
      code === 'no_refresh_token' || code === 'invalid_grant'
        ? 400
        : code === 'bling_oauth_not_configured' || code === 'db_update_failed'
          ? 500
          : 502

    return NextResponse.json(
      {
        ok: false,
        error: code,
        message,
        detail: result.error !== code ? result.error : undefined,
      },
      { status }
    )
  }

  return NextResponse.json({
    ok: true,
    token_expires_at: result.connection.token_expires_at,
  })
}
