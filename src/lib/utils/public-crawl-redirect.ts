import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'
import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

const JUNK_QUERY = /^(attributes?|attribute_id|variation|quantity)$/i

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
  const host = (input.host || '').split(':')[0].toLowerCase()
  const apex = host === 'conectize.com.br'

  if (normalized.toLowerCase() === '/home') {
    return { pathname: '/', search: '' }
  }

  if (isMercadoLivreCrawlPath(normalized)) {
    return { pathname: '/acessorios', search: '' }
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
