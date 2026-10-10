import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APEX_HOST,
  APP_SITE_ORIGIN,
  CANONICAL_SITE_ORIGIN,
  absoluteAppUrl,
  absoluteSiteUrl,
  appHref,
  appPageSeo,
  canonicalAlternates,
  getAppSiteUrl,
  getSiteUrl,
  publicPageSeo,
  publicSaasOrigin,
  saasPageJsonLd,
  storeHref,
} from '@/lib/utils/site-url'

describe('getSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to www canonical origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('normalizes apex production host to https www', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://conectize.com.br')
    expect(getSiteUrl()).toBe('https://www.conectize.com.br')
    expect(getSiteUrl()).not.toContain(`://${APEX_HOST}`)
  })

  it('upgrades http on the production host', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://conectize.com.br')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://www.conectize.com.br/loja')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('strips path and trailing slash from the production origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.conectize.com.br/contato/')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('preserves localhost for development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })

  it('preserves Vercel preview hosts', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://conectize-git-preview.vercel.app')
    expect(getSiteUrl()).toBe('https://conectize-git-preview.vercel.app')
  })

  it('keeps the store origin on www when the env points at the app host', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.conectize.com.br')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
    expect(getAppSiteUrl()).toBe(APP_SITE_ORIGIN)
  })

  it('falls back when the env is not a URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'não é url')
    expect(getSiteUrl()).toBe(CANONICAL_SITE_ORIGIN)
  })
})

describe('public SEO urls', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds canonical, hreflang and og:url on the www origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://conectize.com.br')
    expect(absoluteSiteUrl('/contato')).toBe('https://www.conectize.com.br/contato')
    expect(absoluteSiteUrl('/')).toBe(CANONICAL_SITE_ORIGIN)

    const alternates = canonicalAlternates('/loja')
    expect(alternates.canonical).toBe('https://www.conectize.com.br/loja')
    expect(alternates.languages?.['pt-BR']).toBe(alternates.canonical)
    expect(alternates.languages?.['x-default']).toBe(alternates.canonical)

    const seo = publicPageSeo('/contato', { title: 'Contato', description: 'Fale conosco' })
    expect(seo.openGraph && 'url' in seo.openGraph ? seo.openGraph.url : null).toBe(
      'https://www.conectize.com.br/contato',
    )
    expect(seo.openGraph && 'siteName' in seo.openGraph ? seo.openGraph.siteName : null).toBe('Conectize')
    const image = seo.openGraph && 'images' in seo.openGraph ? seo.openGraph.images : null
    const firstImage = Array.isArray(image) ? image[0] : image
    expect(firstImage && typeof firstImage === 'object' && 'url' in firstImage ? firstImage.url : null).toBe(
      'https://www.conectize.com.br/og-conectize.png',
    )
    expect(firstImage && typeof firstImage === 'object' && 'alt' in firstImage ? firstImage.alt : '').toContain('Conectize')
    expect(seo.twitter?.card).toBe('summary_large_image')
    expect(JSON.stringify(seo)).not.toContain('https://conectize.com.br')
    expect(JSON.stringify(seo)).not.toContain('http://conectize.com.br')
  })
})

describe('app SEO urls', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('points SaaS canonical, og:url and JSON-LD at app.conectize.com.br', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.conectize.com.br')
    expect(absoluteAppUrl('/planos')).toBe(`${APP_SITE_ORIGIN}/planos`)
    expect(absoluteAppUrl('/manual/bling')).toBe(`${APP_SITE_ORIGIN}/manual/bling`)
    expect(appHref('/portal')).toBe(`${APP_SITE_ORIGIN}/portal`)
    expect(storeHref('/')).toBe(CANONICAL_SITE_ORIGIN)

    const seo = appPageSeo('/planos', { title: 'Planos', description: 'Sistema' })
    expect(seo.alternates?.canonical).toBe(`${APP_SITE_ORIGIN}/planos`)
    expect(seo.openGraph && 'url' in seo.openGraph ? seo.openGraph.url : null).toBe(
      `${APP_SITE_ORIGIN}/planos`,
    )
    const image = seo.openGraph && 'images' in seo.openGraph ? seo.openGraph.images : null
    const firstImage = Array.isArray(image) ? image[0] : image
    expect(firstImage && typeof firstImage === 'object' && 'url' in firstImage ? firstImage.url : null).toBe(
      `${APP_SITE_ORIGIN}/og-conectize.png`,
    )

    const jsonLd = saasPageJsonLd({
      path: '/planos',
      title: 'Planos',
      description: 'Sistema',
      type: 'SoftwareApplication',
    })
    expect(jsonLd.url).toBe(`${APP_SITE_ORIGIN}/planos`)
    expect(jsonLd.mainEntityOfPage).toBe(`${APP_SITE_ORIGIN}/planos`)
    expect(JSON.stringify(jsonLd)).not.toContain('https://www.conectize.com.br')
  })

  it('keeps relative links and local origins outside production', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(getAppSiteUrl()).toBe('http://localhost:3000')
    expect(absoluteAppUrl('/planos')).toBe('http://localhost:3000/planos')
    expect(appHref('/portal')).toBe('/portal')
    expect(storeHref('/contato')).toBe('/contato')
    expect(publicSaasOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('uses the app origin for public OS links generated on www or app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.conectize.com.br')
    expect(publicSaasOrigin('https://www.conectize.com.br')).toBe(APP_SITE_ORIGIN)
    expect(publicSaasOrigin('https://app.conectize.com.br')).toBe(APP_SITE_ORIGIN)
    expect(publicSaasOrigin('https://conectize-git-preview.vercel.app')).toBe(
      'https://conectize-git-preview.vercel.app',
    )
  })
})
