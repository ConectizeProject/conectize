import { closestCanonicalServicePath } from '@/lib/utils/canonical-service-path'
import { normalizeHostname } from '@/lib/utils/canonical-host'
import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'
import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'
import { APEX_HOST } from '@/lib/utils/site-url'

const JUNK_QUERY = /^(attributes?|attribute_id|variation|quantity)$/i
const STORE_ACCESSORIES_PATH = '/loja/acessorios'
const CATALOG_FILTER_KEYS = ['servico', 'marca', 'dispositivo', 'modelo', 'page'] as const

export type CrawlRedirect = {
  pathname: string
  search: string
}

function stripTrailingSlash (pathname: string): { pathname: string, hadTrailingSlash: boolean } {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return { pathname: pathname.slice(0, -1), hadTrailingSlash: true }
  }
  return { pathname, hadTrailingSlash: false }
}

function searchWithoutJunk (params: URLSearchParams): { search: string, changed: boolean } {
  const next = new URLSearchParams(params)
  let changed = false
  for (const key of [...next.keys()]) {
    if (JUNK_QUERY.test(key)) {
      next.delete(key)
      changed = true
    }
  }
  const query = next.toString()
  return { search: query ? `?${query}` : '', changed }
}

export function isMercadoLivreCrawlPath (pathname: string): boolean {
  if (/^\/MLB-\w+/i.test(pathname)) return true
  if (/^\/MLB\d+/i.test(pathname)) return true
  if (/^\/p\/MLB\d+/i.test(pathname)) return true
  if (/^\/[^/]+\/p\/MLB\d+/i.test(pathname)) return true
  if (pathname === '/lista' || pathname.startsWith('/lista/')) return true
  return false
}

function serviceDestination (pathname: string): string | null {
  if (pathname !== '/servicos' && !pathname.startsWith('/servicos/')) return null
  const segments = pathname.split('/').filter(Boolean).slice(1)
  if (segments.length === 0) return SERVICES_HUB_PATH
  return resolveLegacyServiceDestination(segments)
}

function isStorefrontPath (pathname: string): boolean {
  if (pathname.startsWith('/portal')) return false
  if (pathname.startsWith('/api')) return false
  if (pathname.startsWith('/os')) return false
  if (pathname.startsWith('/orcamento')) return false
  if (pathname.startsWith('/cadastro')) return false
  return true
}

function catalogFilterDestination (pathname: string, params: URLSearchParams): string | null {
  if (!isStorefrontPath(pathname)) return null
  const hasFilter = CATALOG_FILTER_KEYS.some((key) => params.has(key))
  if (!hasFilter) return null

  if (pathname === SERVICES_HUB_PATH || pathname === '/servicos') {
    return closestCanonicalServicePath({
      serviceSlug: params.get('servico') || undefined,
      brandSlug: params.get('marca') || undefined,
      deviceSlug: params.get('dispositivo') || undefined,
      modelSlug: params.get('modelo') || undefined,
    })
  }

  return pathname
}

/**
 * Um único destino para URLs antigas, barra final, lixo de query do Mercado Livre
 * e host apex. Null quando a requisição já está na URL final.
 */
export function resolvePublicCrawlRedirect (input: {
  pathname: string
  searchParams: URLSearchParams
  host?: string
}): CrawlRedirect | null {
  const { pathname: normalized, hadTrailingSlash } = stripTrailingSlash(input.pathname)
  const host = normalizeHostname(input.host || '')
  const apex = host === APEX_HOST

  if (normalized.toLowerCase() === '/home') {
    return { pathname: '/', search: '' }
  }

  if (isMercadoLivreCrawlPath(normalized) || normalized === '/acessorios') {
    return { pathname: STORE_ACCESSORIES_PATH, search: '' }
  }

  const filtered = catalogFilterDestination(normalized, input.searchParams)
  if (filtered) {
    return { pathname: filtered, search: '' }
  }

  const legacy = serviceDestination(normalized)
  if (legacy && legacy !== normalized) {
    return { pathname: legacy, search: '' }
  }

  const cleaned = searchWithoutJunk(input.searchParams)
  if (hadTrailingSlash || apex || cleaned.changed) {
    return { pathname: normalized, search: cleaned.search }
  }

  return null
}
