import { APEX_HOST, CANONICAL_HOST, CANONICAL_SITE_ORIGIN } from './site-url'

/**
 * Host público da requisição.
 * No dev o `nextUrl.hostname` vira localhost mesmo com o domínio real no header.
 */
export function publicHostnameFromHeaders (
  headers: { get (name: string): string | null },
  fallback = '',
): string {
  return headers.get('x-forwarded-host') || headers.get('host') || fallback
}

/** Host do header, sem porta e sem ponto final de FQDN. */
export function normalizeHostname (host: string): string {
  const first = host.split(',')[0]?.trim() ?? ''
  if (!first) return ''
  const withoutPort = first.startsWith('[') ? first : first.replace(/:\d+$/, '')
  return withoutPort.toLowerCase().replace(/\.$/, '')
}

/**
 * Dev, localhost e previews da Vercel não redirecionam.
 * Host vazio também fica de fora.
 */
export function isLocalOrPreviewHost (hostname: string): boolean {
  const host = normalizeHostname(hostname)
  if (!host) return true
  if (
    host === 'localhost'
    || host === '127.0.0.1'
    || host === '0.0.0.0'
    || host === '::1'
    || host === '[::1]'
  ) return true
  if (host.endsWith('.localhost')) return true
  if (host.endsWith('.vercel.app')) return true
  return false
}

/**
 * Destino absoluto do redirect de host, ou null quando a requisição já está no canônico.
 * Só mexe em conectize.com.br (apex) e em http de www. Outros hosts passam direto.
 */
export function resolveCanonicalRedirect (input: {
  hostname: string
  protocol: string
  pathname: string
  search?: string
}): string | null {
  const hostname = normalizeHostname(input.hostname)
  if (!hostname || isLocalOrPreviewHost(hostname)) return null

  const protocol = input.protocol.replace(/:$/, '').split(',')[0]?.trim().toLowerCase() ?? ''
  const isApex = hostname === APEX_HOST
  const isCanonicalHost = hostname === CANONICAL_HOST
  if (!isApex && !isCanonicalHost) return null

  const needsHttps = protocol === 'http'
  if (!isApex && !needsHttps) return null

  const pathname = input.pathname.startsWith('/') ? input.pathname : `/${input.pathname || ''}`
  const rawSearch = input.search ?? ''
  const search = rawSearch
    ? (rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`)
    : ''
  return `${CANONICAL_SITE_ORIGIN}${pathname}${search}`
}

/** GET/HEAD usam 301. Os demais usam 308 para preservar método e corpo (webhooks). */
export function canonicalRedirectStatus (method: string): 301 | 308 {
  const normalized = method.toUpperCase()
  if (normalized === 'GET' || normalized === 'HEAD') return 301
  return 308
}
