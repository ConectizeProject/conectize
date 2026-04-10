import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/auth/portal-api'
import { BLING_API_V3_BASE_URL } from '@/lib/integrations/bling/constants'

const BLING_AUTHORIZE_URL = `${BLING_API_V3_BASE_URL}/oauth/authorize`

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

export async function GET (request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.redirect(new URL('/portal/login', getAppBaseUrl(request)))
  }

  const clientId = process.env.BLING_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Bling OAuth nÃ£o configurado. Defina BLING_CLIENT_ID e BLING_CLIENT_SECRET.' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()
  const redirectUri = getBlingRedirectUri(request)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
  })

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

  return NextResponse.redirect(authorizeUrl)
}
