import { BLING_OAUTH_CALLBACK_PATH } from '@/lib/integrations/bling/app-registration'

type HeaderReader = {
  get (name: string): string | null
}

export function blingOriginFromHeaders (headerList: HeaderReader): string {
  const forwardedHost = headerList.get('x-forwarded-host')
  const host = (forwardedHost || headerList.get('host') || '').trim()
  if (!host) return ''

  const forwardedProto = headerList.get('x-forwarded-proto')
  const proto = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`.replace(/\/$/, '')
}

export function blingRequestOrigin (request: {
  headers: HeaderReader
  nextUrl: { origin: string }
}): string {
  const fromHeaders = blingOriginFromHeaders(request.headers)
  if (request.headers.get('x-forwarded-host') && fromHeaders) return fromHeaders
  return request.nextUrl.origin.replace(/\/$/, '')
}

/** Mesma URL enviada no OAuth e exibida na modal do HUB. */
export function blingOAuthRedirectUri (origin: string): string {
  const configured = process.env.BLING_REDIRECT_URI?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return `${origin.replace(/\/$/, '')}${BLING_OAUTH_CALLBACK_PATH}`
}
