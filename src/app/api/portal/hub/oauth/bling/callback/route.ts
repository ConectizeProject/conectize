import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token'
const PLATFORM_ID = 'bling'

function normalizeUrl (value: string) {
  return value.trim().replace(/\/$/, '')
}

function getRequestOrigin (request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
  }

  return request.nextUrl.origin.replace(/\/$/, '')
}

function getAppBaseUrl (request: NextRequest) {
  return getRequestOrigin(request)
}

function getBlingRedirectUri (request: NextRequest) {
  const configuredRedirectUri = process.env.BLING_REDIRECT_URI
  if (configuredRedirectUri) {
    return normalizeUrl(configuredRedirectUri)
  }

  return `${getRequestOrigin(request)}/api/portal/hub/oauth/bling/callback`
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return NextResponse.redirect(new URL('/portal/login', getAppBaseUrl(request)))
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (appUser?.role !== 'admin') {
    return NextResponse.redirect(new URL('/portal/minhas-ordens', getAppBaseUrl(request)))
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/portal/hub?toast=bling_error&message=${encodeURIComponent(error)}`, getAppBaseUrl(request))
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=missing_params', getAppBaseUrl(request)))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('hub_oauth_state')?.value
  const redirectTo = cookieStore.get('hub_oauth_redirect')?.value || '/portal/hub'

  cookieStore.delete('hub_oauth_state')
  cookieStore.delete('hub_oauth_redirect')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=invalid_state', getAppBaseUrl(request)))
  }

  const clientId = process.env.BLING_CLIENT_ID
  const clientSecret = process.env.BLING_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=config_missing', getAppBaseUrl(request)))
  }

  const redirectUri = getBlingRedirectUri(request)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '1.0',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json().catch(() => null)

  if (!tokenRes.ok || !tokenData?.access_token) {
    const errMsg = tokenData?.error_description || tokenData?.error || 'token_failed'
    return NextResponse.redirect(
      new URL(`/portal/hub?toast=bling_error&message=${encodeURIComponent(String(errMsg))}`, getAppBaseUrl(request))
    )
  }

  const expiresIn = Number(tokenData.expires_in) || 3600
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('hub_connections')
    .upsert(
      {
        platform_id: PLATFORM_ID,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        api_key: null,
        metadata: { scope: tokenData.scope || null },
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform_id,created_by' }
    )

  if (dbError) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=db_error', getAppBaseUrl(request)))
  }

  return NextResponse.redirect(new URL(`${redirectTo}?toast=bling_connected`, getAppBaseUrl(request)))
}
