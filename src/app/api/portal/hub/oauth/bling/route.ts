import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/auth/portal-api'
import { resolveBlingAppCredentials } from '@/lib/integrations/bling/app-credentials'
import { BLING_API_V3_BASE_URL } from '@/lib/integrations/bling/constants'
import { blingOAuthRedirectUri, blingRequestOrigin } from '@/lib/integrations/bling/oauth-redirect'
import { resolveHubSecretsReader } from '@/lib/supabase/hub-secrets'

const BLING_AUTHORIZE_URL = `${BLING_API_V3_BASE_URL}/oauth/authorize`
const PLATFORM_ID = 'bling'

export async function GET (request: NextRequest) {
  const origin = blingRequestOrigin(request)
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) {
      return NextResponse.redirect(new URL('/portal/login', origin))
    }
    return NextResponse.redirect(new URL('/portal/minhas-ordens', origin))
  }

  const requestedId = request.nextUrl.searchParams.get('connectionId')?.trim() || ''
  let connectionQuery = resolveHubSecretsReader(auth.supabase)
    .from('hub_connections')
    .select('id, metadata, api_key')
    .eq('platform_id', PLATFORM_ID)
    .eq('organization_id', auth.organizationId)
  connectionQuery = requestedId
    ? connectionQuery.eq('id', requestedId)
    : connectionQuery.order('updated_at', { ascending: false }).limit(1)

  const { data: connection } = await connectionQuery.maybeSingle()

  const credentials = resolveBlingAppCredentials(connection)
  if (!credentials) {
    return NextResponse.redirect(
      new URL('/portal/hub?toast=bling_error&message=client_id_missing', origin)
    )
  }

  const state = crypto.randomUUID()
  const redirectUri = blingOAuthRedirectUri(origin)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials.clientId,
    state,
    redirect_uri: redirectUri,
  })

  const scope = process.env.BLING_OAUTH_SCOPE?.trim()
  if (scope) {
    params.set('scope', scope)
  }

  const authorizeUrl = `${BLING_AUTHORIZE_URL}?${params.toString()}`

  const cookieStore = await cookies()
  cookieStore.set('hub_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookieStore.set('hub_oauth_redirect', '/portal/hub', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  if (connection?.id) {
    cookieStore.set('hub_oauth_bling_connection', String(connection.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
  }

  return NextResponse.redirect(authorizeUrl)
}
