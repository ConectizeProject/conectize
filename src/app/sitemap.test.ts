import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { isIndexableServiceProductSlug } from '@/lib/utils/canonical-service-path'
import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'
import { resolvePublicCrawlRedirect } from '@/lib/utils/public-crawl-redirect'

describe('sitemap', () => {
  it('lists only final urls on www, without query, redirects or MLB', () => {
    const entries = sitemap()
    expect(entries.length).toBeGreaterThan(100)
    const pathnames = entries.map((entry) => new URL(entry.url).pathname)
    expect(pathnames).not.toContain('/planos')
    expect(pathnames).not.toContain('/manual/bling')
    expect(pathnames).not.toContain('/acessorios')
    expect(pathnames).toContain('/loja/acessorios')

    for (const entry of entries) {
      const url = new URL(entry.url)
      expect(url.origin).toBe('https://www.conectize.com.br')
      expect(url.search).toBe('')
      expect(url.pathname.toLowerCase()).not.toContain('mlb')
      expect(url.pathname.endsWith('/')).toBe(url.pathname === '/')

      const redirect = resolvePublicCrawlRedirect({
        pathname: url.pathname,
        searchParams: url.searchParams,
        host: 'www.conectize.com.br',
      })
      expect(redirect).toBeNull()

      if (!url.pathname.startsWith('/servicos/')) continue
      const slug = url.pathname.slice('/servicos/'.length)
      expect(slug.includes('/')).toBe(false)
      expect(resolveLegacyServiceDestination([slug])).toBeNull()
      expect(isIndexableServiceProductSlug(slug)).toBe(true)
      expect(slug).not.toMatch(/Smartphone|iPhone|iPad|MacBook/)
    }
  })
})
