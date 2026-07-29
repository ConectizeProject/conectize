/** URL canônica pública do site (host preferido em produção: www). */
export const CANONICAL_SITE_ORIGIN = 'https://www.conectize.com.br'

/**
 * Origem do site para canonical, sitemap, JSON-LD e metadataBase.
 * Normaliza apex → www para não divergir do redirect de produção.
 * Localhost e outros hosts de preview/dev são preservados.
 */
export function getSiteUrl (): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || CANONICAL_SITE_ORIGIN

  try {
    const url = new URL(raw)
    if (url.hostname === 'conectize.com.br') {
      url.hostname = 'www.conectize.com.br'
    }
    return url.origin
  } catch {
    return CANONICAL_SITE_ORIGIN
  }
}
