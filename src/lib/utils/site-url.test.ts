import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APEX_HOST,
  CANONICAL_SITE_ORIGIN,
  absoluteSiteUrl,
  canonicalAlternates,
  getSiteUrl,
  publicPageSeo,
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

    const seo = publicPageSeo('/planos', { title: 'Planos', description: 'Sistema' })
    expect(seo.openGraph && 'url' in seo.openGraph ? seo.openGraph.url : null).toBe(
      'https://www.conectize.com.br/planos',
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
