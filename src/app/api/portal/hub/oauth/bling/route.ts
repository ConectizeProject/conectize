import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const BLING_AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize'

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

  return { ok: true as const }
}

export async function GET (request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.redirect(new URL('/portal/login', getAppBaseUrl(request)))
  }

  const clientId = process.env.BLING_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Bling OAuth não configurado. Defina BLING_CLIENT_ID e BLING_CLIENT_SECRET.' },
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
