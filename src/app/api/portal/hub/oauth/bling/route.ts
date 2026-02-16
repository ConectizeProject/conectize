import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const BLING_AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize'

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  if (url) return url.startsWith('http') ? url : `https://${url}`
  return 'http://localhost:3000'
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
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

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.redirect(new URL('/portal/login', getBaseUrl()))
  }

  const clientId = process.env.BLING_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Bling OAuth não configurado. Defina BLING_CLIENT_ID e BLING_CLIENT_SECRET.' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()
  const redirectUri = `${getBaseUrl()}/api/portal/hub/oauth/bling/callback`

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
