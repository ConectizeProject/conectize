import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { BLING_API_V3_BASE_URL } from '@/lib/integrations/bling/constants'
import {
  blingAuthorizeErrorToMessageKey,
  blingTokenErrorToMessageKey,
  truncateBlingHubQueryDetail,
} from '@/lib/integrations/bling/hub-oauth-query'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  fetchBlingCompanyProfile,
  mergeBlingCompanyProfileMetadata,
} from '@/lib/integrations/bling/company-profile'
import { resolveBlingAppCredentials } from '@/lib/integrations/bling/app-credentials'
import { blingOAuthRedirectUri, blingRequestOrigin } from '@/lib/integrations/bling/oauth-redirect'

const BLING_TOKEN_URL = `${BLING_API_V3_BASE_URL}/oauth/token`
const PLATFORM_ID = 'bling'

function getAppBaseUrl (request: NextRequest) {
  return blingRequestOrigin(request)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) {
      return NextResponse.redirect(new URL('/portal/login', getAppBaseUrl(request)))
    }
    return NextResponse.redirect(new URL('/portal/minhas-ordens', getAppBaseUrl(request)))
  }
  const supabase = auth.supabase

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    const messageKey = blingAuthorizeErrorToMessageKey(error)
    const params = new URLSearchParams({
      toast: 'bling_error',
      message: messageKey,
    })
    const rawDesc = searchParams.get('error_description')
    const detailParts: string[] = []
    if (messageKey === 'bling_oauth_unknown') {
      detailParts.push(`Código retornado pelo Bling: ${error}`)
    }
    if (rawDesc) {
      detailParts.push(rawDesc)
    }
    const detail = detailParts.length
      ? truncateBlingHubQueryDetail(detailParts.join(' — '))
      : ''
    if (detail) {
      params.set('detail', detail)
    }
    return NextResponse.redirect(
      new URL(`/portal/hub?${params.toString()}`, getAppBaseUrl(request))
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=missing_params', getAppBaseUrl(request)))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('hub_oauth_state')?.value
  const redirectTo = cookieStore.get('hub_oauth_redirect')?.value || '/portal/hub'

  const blingConnectionId = cookieStore.get('hub_oauth_bling_connection')?.value || ''

  cookieStore.delete('hub_oauth_state')
  cookieStore.delete('hub_oauth_redirect')
  cookieStore.delete('hub_oauth_bling_connection')

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=invalid_state', getAppBaseUrl(request)))
  }

  let existingQuery = supabase
    .from('hub_connections')
    .select('id, metadata, api_key')
    .eq('platform_id', PLATFORM_ID)
    .eq('organization_id', auth.organizationId)
  existingQuery = blingConnectionId
    ? existingQuery.eq('id', blingConnectionId)
    : existingQuery.order('updated_at', { ascending: false }).limit(1)

  const { data: existing } = await existingQuery.maybeSingle()

  const appCredentials = resolveBlingAppCredentials(existing)
  if (!appCredentials) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=config_missing', getAppBaseUrl(request)))
  }

  const redirectUri = blingOAuthRedirectUri(getAppBaseUrl(request))
  const credentials = Buffer.from(`${appCredentials.clientId}:${appCredentials.clientSecret}`).toString('base64')

  const tokenRes = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: '1.0',
      Authorization: `Basic ${credentials}`,
      'enable-jwt': '1',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokenData = await tokenRes.json().catch(() => null)

  if (!tokenRes.ok || !tokenData?.access_token) {
    const errCode =
      typeof tokenData?.error === 'string' && tokenData.error.trim()
        ? tokenData.error.trim()
        : 'token_failed'
    const messageKey =
      errCode === 'token_failed' ? 'token_failed' : blingTokenErrorToMessageKey(errCode)
    const params = new URLSearchParams({
      toast: 'bling_error',
      message: messageKey,
    })
    const rawDesc =
      typeof tokenData?.error_description === 'string'
        ? tokenData.error_description.trim()
        : ''
    const detailParts: string[] = []
    if (messageKey === 'bling_token_unknown') {
      detailParts.push(`Resposta do Bling: ${errCode}`)
    }
    if (rawDesc) {
      detailParts.push(rawDesc)
    }
    if (!tokenRes.ok && !rawDesc) {
      detailParts.push(`HTTP ${tokenRes.status}`)
    }
    const detail = detailParts.length
      ? truncateBlingHubQueryDetail(detailParts.join(' — '))
      : ''
    if (detail) {
      params.set('detail', detail)
    }
    return NextResponse.redirect(
      new URL(`/portal/hub?${params.toString()}`, getAppBaseUrl(request))
    )
  }

  const expiresIn = Number(tokenData.expires_in) || 3600
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const companyProfile = await fetchBlingCompanyProfile(String(tokenData.access_token))
  const now = new Date().toISOString()

  const previousMetadata =
    existing?.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {}

  const connectionPayload = {
    platform_id: PLATFORM_ID,
    organization_id: auth.organizationId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    token_expires_at: tokenExpiresAt,
    metadata: mergeBlingCompanyProfileMetadata(
      {
        ...previousMetadata,
        scope: tokenData.scope || previousMetadata.scope || null,
        blingReconnectRequired: false,
        blingReconnectReason: null,
        blingReconnectAt: null,
        blingLastRefreshError: null,
      },
      companyProfile ?? {
        empresaId: null,
        nome: null,
        email: null,
        cnpj: null,
        logoUrl: null,
      },
    ),
    updated_at: now,
  }

  const dbError = existing?.id
    ? (await supabase
      .from('hub_connections')
      .update(connectionPayload)
      .eq('id', existing.id)).error
    : (await supabase
      .from('hub_connections')
      .insert({
        ...connectionPayload,
        created_by: auth.userId,
      })).error

  if (dbError) {
    return NextResponse.redirect(new URL('/portal/hub?toast=bling_error&message=db_error', getAppBaseUrl(request)))
  }

  return NextResponse.redirect(new URL(`${redirectTo}?toast=bling_connected`, getAppBaseUrl(request)))
}
