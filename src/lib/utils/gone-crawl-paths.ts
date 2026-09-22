const EXACT_GONE_PATHS = new Set([
  '/share',
  '/navigationaddresses-hub',
  '/zO2ixMhVjY2kPD8dEV5bg==',
  '/&',
  '/%26',
])

/**
 * URLs que o Google rastreia e que nunca vão existir neste site
 * (loja antiga do Mercado Livre e tokens soltos).
 */
export function isGoneCrawlPath (pathname: string): boolean {
  if (EXACT_GONE_PATHS.has(pathname)) return true
  if (pathname.startsWith('/p/MLB') || pathname.startsWith('/p/mlb')) return false
  return pathname.startsWith('/p/')
}

export function goneCrawlResponse (): Response {
  return new Response('Gone', {
    status: 410,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
