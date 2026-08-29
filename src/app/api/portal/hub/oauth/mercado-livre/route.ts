import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { MELI_AUTH_BASE_URL } from '@/lib/integrations/mercado-livre/constants'
import {
  getAppBaseUrl,
  getMeliRedirectUri,
} from '@/lib/integrations/mercado-livre/oauth-redirect'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) {
      return NextResponse.redirect(
        new URL('/portal/login', getAppBaseUrl(request)),
      )
    }
    return NextResponse.redirect(
      new URL('/portal/minhas-ordens', getAppBaseUrl(request)),
    )
  }

  const clientId = process.env.MELI_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        '/portal/hub?toast=meli_error&message=client_id_missing',
        getAppBaseUrl(request),
      ),
    )
  }

  const state = crypto.randomUUID()
  const redirectUri = getMeliRedirectUri(request)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state,
    redirect_uri: redirectUri,
  })

  const authorizeUrl = `${MELI_AUTH_BASE_URL}/authorization?${params.toString()}`

  const cookieStore = await cookies()
  cookieStore.set('meli_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookieStore.set('meli_oauth_redirect', '/portal/hub', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return NextResponse.redirect(authorizeUrl)
}
