import { describe, expect, it } from 'vitest'
import { buildAppRobotsTxt } from '@/lib/seo/app-robots'
import {
	APP_SITEMAP_PATHS,
	buildAppSitemap,
	renderSitemapXml,
} from '@/lib/seo/app-sitemap'
import { APP_SITE_ORIGIN } from '@/lib/utils/site-url'

describe('app sitemap and robots', () => {
	it('lists only public SaaS pages on the app origin', () => {
		const entries = buildAppSitemap(new Date('2026-01-01T00:00:00.000Z'))
		const pathnames = entries.map((entry) => new URL(entry.url).pathname)
		expect(pathnames).toEqual([...APP_SITEMAP_PATHS])
		for (const entry of entries) {
			expect(new URL(entry.url).origin).toBe(APP_SITE_ORIGIN)
		}
		expect(pathnames).not.toContain('/portal/login')
		expect(pathnames).not.toContain('/portal')
		expect(pathnames).not.toContain('/os')
		expect(pathnames).not.toContain('/')

		const xml = renderSitemapXml(entries)
		expect(xml).toContain(`${APP_SITE_ORIGIN}/planos`)
		expect(xml).toContain(`${APP_SITE_ORIGIN}/manual/bling`)
		expect(xml).not.toContain('/portal/login')
		expect(xml).not.toContain('www.conectize.com.br')
	})

	it('hides the portal and points the sitemap at the app host', () => {
		const robots = buildAppRobotsTxt()
		expect(robots).toContain('Allow: /planos')
		expect(robots).toContain('Allow: /manual/')
		expect(robots).toContain('Disallow: /portal')
		expect(robots).toContain('Disallow: /api/')
		expect(robots).toContain(`Sitemap: ${APP_SITE_ORIGIN}/sitemap.xml`)
		expect(robots).not.toContain('www.conectize.com.br')
	})
})
