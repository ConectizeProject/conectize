import type { Metadata } from 'next'

/** Host público preferido. Apex e http deste domínio são normalizados para cá. */
export const CANONICAL_HOST = 'www.conectize.com.br'

/** Host sem www. Só entra em comparação de redirect, nunca em URL de SEO. */
export const APEX_HOST = 'conectize.com.br'

/** URL canônica pública do site (https + www, sem barra final). */
export const CANONICAL_SITE_ORIGIN = `https://${CANONICAL_HOST}`

function isProductionHost (hostname: string): boolean {
  return hostname === APEX_HOST || hostname === CANONICAL_HOST
}

/**
 * Origem do site para canonical, sitemap, JSON-LD, hreflang e metadataBase.
 * No domínio de produção, apex e http viram https://www.conectize.com.br.
 * Localhost, preview da Vercel e outros hosts são preservados.
 */
export function getSiteUrl (): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || CANONICAL_SITE_ORIGIN

  try {
    const url = new URL(raw)
    if (isProductionHost(url.hostname.toLowerCase())) return CANONICAL_SITE_ORIGIN
    return url.origin
  } catch {
    return CANONICAL_SITE_ORIGIN
  }
}

/** URL absoluta do site. `path` vazio ou `/` devolve só a origem. */
export function absoluteSiteUrl (path = '/'): string {
  const origin = getSiteUrl()
  if (!path || path === '/') return origin
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalized}`
}

/** Canonical + hreflang pt-BR e x-default na mesma URL www. */
export function canonicalAlternates (path = '/'): NonNullable<Metadata['alternates']> {
  const canonical = absoluteSiteUrl(path)
  return {
    canonical,
    languages: {
      'pt-BR': canonical,
      'x-default': canonical,
    },
  }
}

type PublicPageSeoInput = {
  title?: string
  description?: string
  siteName?: string
}

/**
 * Canonical, hreflang e og:url da página.
 * O openGraph é completo porque no App Router o openGraph do segmento substitui o do layout.
 */
export function publicPageSeo (
  path = '/',
  seo: PublicPageSeoInput = {},
): Pick<Metadata, 'alternates' | 'openGraph'> {
  const url = absoluteSiteUrl(path)
  return {
    alternates: canonicalAlternates(path),
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: seo.siteName ?? 'Conectize',
      ...(seo.title ? { title: seo.title } : {}),
      ...(seo.description ? { description: seo.description } : {}),
      url,
    },
  }
}
