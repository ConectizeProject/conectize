import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getMeliUserMe } from '@/lib/integrations/mercado-livre/api'
import {
  MELI_API_BASE_URL,
  MELI_PLATFORM_ID,
} from '@/lib/integrations/mercado-livre/constants'
import {
  meliAuthorizeErrorToMessageKey,
  meliTokenErrorToMessageKey,
  truncateMeliHubQueryDetail,
} from '@/lib/integrations/mercado-livre/hub-oauth-query'
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
  const supabase = auth.supabase

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    const messageKey = meliAuthorizeErrorToMessageKey(error)
    const params = new URLSearchParams({
      toast: 'meli_error',
      message: messageKey,
    })
    const rawDesc = searchParams.get('error_description')
    const detailParts: string[] = []
    if (messageKey === 'meli_oauth_unknown') {
      detailParts.push(`Código retornado pelo Mercado Livre: ${error}`)
    }
    if (rawDesc) detailParts.push(rawDesc)
    const detail = detailParts.length
      ? truncateMeliHubQueryDetail(detailParts.join(' — '))
      : ''
    if (detail) params.set('detail', detail)
    return NextResponse.redirect(
      new URL(`/portal/hub?${params.toString()}`, getAppBaseUrl(request)),
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        '/portal/hub?toast=meli_error&message=missing_params',
        getAppBaseUrl(request),
      ),
    )
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('meli_oauth_state')?.value
  const redirectTo =
    cookieStore.get('meli_oauth_redirect')?.value || '/portal/hub'

  cookieStore.delete('meli_oauth_state')
  cookieStore.delete('meli_oauth_redirect')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL(
        '/portal/hub?toast=meli_error&message=invalid_state',
        getAppBaseUrl(request),
      ),
    )
  }

  const clientId = process.env.MELI_CLIENT_ID
  const clientSecret = process.env.MELI_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(
        '/portal/hub?toast=meli_error&message=config_missing',
        getAppBaseUrl(request),
      ),
    )
  }

  const redirectUri = getMeliRedirectUri(request)
  const tokenRes = await fetch(`${MELI_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = (await tokenRes.json().catch(() => null)) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    user_id?: number | string
    error?: string
    error_description?: string
    message?: string
  } | null

  if (!tokenRes.ok || !tokenData?.access_token) {
    const errCode =
      typeof tokenData?.error === 'string' && tokenData.error.trim()
        ? tokenData.error.trim()
        : 'token_failed'
    const messageKey =
      errCode === 'token_failed'
        ? 'token_failed'
        : meliTokenErrorToMessageKey(errCode)
    const params = new URLSearchParams({
      toast: 'meli_error',
      message: messageKey,
    })
    const rawDesc =
      typeof tokenData?.error_description === 'string'
        ? tokenData.error_description.trim()
        : typeof tokenData?.message === 'string'
          ? tokenData.message.trim()
          : ''
    const detailParts: string[] = []
    if (messageKey === 'meli_token_unknown') {
      detailParts.push(`Resposta do Mercado Livre: ${errCode}`)
    }
    if (rawDesc) detailParts.push(rawDesc)
    if (!tokenRes.ok && !rawDesc) detailParts.push(`HTTP ${tokenRes.status}`)
    const detail = detailParts.length
      ? truncateMeliHubQueryDetail(detailParts.join(' — '))
      : ''
    if (detail) params.set('detail', detail)
    return NextResponse.redirect(
      new URL(`/portal/hub?${params.toString()}`, getAppBaseUrl(request)),
    )
  }

  const expiresIn = Number(tokenData.expires_in) || 21600
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  const me = await getMeliUserMe(String(tokenData.access_token))
  const userId =
    me?.id != null
      ? String(me.id)
      : tokenData.user_id != null
        ? String(tokenData.user_id)
        : null

  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('hub_connections')
    .select('id, metadata')
    .eq('platform_id', MELI_PLATFORM_ID)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  const previousMetadata =
    existing?.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {}

  const connectionPayload = {
    platform_id: MELI_PLATFORM_ID,
    organization_id: auth.organizationId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    token_expires_at: tokenExpiresAt,
    api_key: null,
    metadata: {
      ...previousMetadata,
      user_id: userId,
      nickname: me?.nickname ?? previousMetadata.nickname ?? null,
      email: me?.email ?? previousMetadata.email ?? null,
      first_name: me?.first_name ?? previousMetadata.first_name ?? null,
      last_name: me?.last_name ?? previousMetadata.last_name ?? null,
      site_id: me?.site_id ?? previousMetadata.site_id ?? null,
      scope: tokenData.scope || previousMetadata.scope || null,
      meliReconnectRequired: false,
      meliReconnectReason: null,
      meliReconnectAt: null,
      meliLastRefreshError: null,
    },
    updated_at: now,
  }

  const dbError = existing?.id
    ? (
        await supabase
          .from('hub_connections')
          .update(connectionPayload)
          .eq('id', existing.id)
      ).error
    : (
        await supabase.from('hub_connections').insert({
          ...connectionPayload,
          created_by: auth.userId,
        })
      ).error

  if (dbError) {
    return NextResponse.redirect(
      new URL(
        '/portal/hub?toast=meli_error&message=db_error',
        getAppBaseUrl(request),
      ),
    )
  }

  return NextResponse.redirect(
    new URL(`${redirectTo}?toast=meli_connected`, getAppBaseUrl(request)),
  )
}
