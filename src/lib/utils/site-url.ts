import type { Metadata } from 'next'

/** Host público preferido. Apex e http deste domínio são normalizados para cá. */
export const CANONICAL_HOST = 'www.conectize.com.br'

/** Host sem www. Só entra em comparação de redirect, nunca em URL de SEO. */
export const APEX_HOST = 'conectize.com.br'

/** URL canônica pública do site (https + www, sem barra final). */
export const CANONICAL_SITE_ORIGIN = `https://${CANONICAL_HOST}`

/** Host do SaaS (gestão, portal, manuais). Mesmo projeto Vercel, domínio adicional. */
export const APP_HOST = 'app.conectize.com.br'

/** Origem canônica do SaaS (https, sem barra final). */
export const APP_SITE_ORIGIN = `https://${APP_HOST}`

export const OG_IMAGE_PATH = '/og-conectize.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_ALT = 'Conectize: assistência técnica de celular e loja de peças em Belo Horizonte'

function isProductionHost (hostname: string): boolean {
  return hostname === APEX_HOST || hostname === CANONICAL_HOST || hostname === APP_HOST
}

/** Apex, www ou app. Localhost e preview da Vercel ficam de fora. */
export function isProductionSiteUrl (origin: string): boolean {
  try {
    return isProductionHost(new URL(origin).hostname.toLowerCase())
  } catch {
    return false
  }
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

/**
 * Origem do SaaS para canonical, sitemap e JSON-LD.
 * Em produção (www, apex ou app) aponta para https://app.conectize.com.br.
 * Localhost e preview preservam a origem do ambiente.
 */
export function getAppSiteUrl (): string {
  const site = getSiteUrl()
  if (isProductionSiteUrl(site)) return APP_SITE_ORIGIN
  return site
}

/** URL absoluta do SaaS. Em dev/preview fica na origem local. */
export function absoluteAppUrl (path = '/'): string {
  const origin = getAppSiteUrl()
  if (!path || path === '/') return origin
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalized}`
}

/**
 * Link da loja para uma rota do sistema.
 * Em produção vira URL absoluta de app. Em localhost e preview permanece relativa.
 */
export function appHref (path: string): string {
  if (!path || path === '/') {
    return isProductionSiteUrl(getSiteUrl()) ? APP_SITE_ORIGIN : '/'
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!isProductionSiteUrl(getSiteUrl())) return normalized
  return `${APP_SITE_ORIGIN}${normalized}`
}

/**
 * Na superfície app (host real ou CONECTIZE_SURFACE=app) os links da loja
 * saem para www, inclusive no dev. Fora isso, localhost e preview ficam relativos.
 */
function storeLinksUseCanonicalWww (): boolean {
  const surface = (process.env.CONECTIZE_SURFACE || '').trim().toLowerCase()
  if (surface === 'app' || surface === APP_HOST) return true
  return isProductionSiteUrl(getSiteUrl())
}

/**
 * Link do SaaS para uma página da loja.
 * Em produção vira URL absoluta de www. Em localhost e preview permanece relativa,
 * salvo simulação da superfície app.
 */
export function storeHref (path: string): string {
  if (!path || path === '/') {
    return storeLinksUseCanonicalWww() ? CANONICAL_SITE_ORIGIN : '/'
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!storeLinksUseCanonicalWww()) return normalized
  return `${CANONICAL_SITE_ORIGIN}${normalized}`
}

/**
 * Origem de links públicos do SaaS (OS, orçamento).
 * No domínio de produção usa app. Em outro host (preview, localhost) usa a origem viva.
 */
export function publicSaasOrigin (liveOrigin?: string): string {
  const live = (liveOrigin || '').replace(/\/$/, '')
  if (live) {
    try {
      const host = new URL(live).hostname.toLowerCase()
      if (isProductionHost(host)) return APP_SITE_ORIGIN
      return live
    } catch {
      // origem inválida: cai no env
    }
  }
  return getAppSiteUrl()
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

export function socialImage () {
  return {
    url: absoluteSiteUrl(OG_IMAGE_PATH),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: OG_IMAGE_ALT,
  }
}

export function appSocialImage () {
  return {
    url: absoluteAppUrl(OG_IMAGE_PATH),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: OG_IMAGE_ALT,
  }
}

/**
 * Canonical, hreflang e og:url da página.
 * O openGraph é completo porque no App Router o openGraph do segmento substitui o do layout.
 */
export function publicPageSeo (
  path = '/',
  seo: PublicPageSeoInput = {},
): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  const url = absoluteSiteUrl(path)
  const image = socialImage()
  return {
    alternates: canonicalAlternates(path),
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: seo.siteName ?? 'Conectize',
      ...(seo.title ? { title: seo.title } : {}),
      ...(seo.description ? { description: seo.description } : {}),
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      ...(seo.title ? { title: seo.title } : {}),
      ...(seo.description ? { description: seo.description } : {}),
      images: [image.url],
    },
  }
}

/** Canonical, hreflang e og:url de uma página pública do SaaS, na origem app. */
export function appPageSeo (
  path = '/',
  seo: PublicPageSeoInput = {},
): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  const url = absoluteAppUrl(path)
  const image = appSocialImage()
  return {
    alternates: {
      canonical: url,
      languages: {
        'pt-BR': url,
        'x-default': url,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: seo.siteName ?? 'Conectize',
      ...(seo.title ? { title: seo.title } : {}),
      ...(seo.description ? { description: seo.description } : {}),
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      ...(seo.title ? { title: seo.title } : {}),
      ...(seo.description ? { description: seo.description } : {}),
      images: [image.url],
    },
  }
}

type SaasJsonLdType = 'SoftwareApplication' | 'TechArticle'

/** JSON-LD da página do SaaS. A URL é a origem app em produção. */
export function saasPageJsonLd (input: {
  path: string
  title: string
  description: string
  type: SaasJsonLdType
}) {
  const url = absoluteAppUrl(input.path)
  return {
    '@context': 'https://schema.org',
    '@type': input.type,
    name: input.title,
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: url,
  }
}
