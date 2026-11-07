import type { MetadataRoute } from 'next'
import { APP_SITE_ORIGIN } from '@/lib/utils/site-url'

/** Páginas públicas indexáveis do SaaS. Portal, login, OS e cadastro ficam de fora. */
export const APP_SITEMAP_PATHS = ['/planos', '/manual/bling'] as const

export function buildAppSitemap(
	lastModified = new Date(),
): MetadataRoute.Sitemap {
	return [
		{
			url: `${APP_SITE_ORIGIN}/planos`,
			lastModified,
			changeFrequency: 'monthly',
			priority: 0.8,
		},
		{
			url: `${APP_SITE_ORIGIN}/manual/bling`,
			lastModified,
			changeFrequency: 'monthly',
			priority: 0.5,
		},
	]
}

export function renderSitemapXml(entries: MetadataRoute.Sitemap): string {
	const urls = entries
		.map((entry) => {
			const lastmod = entry.lastModified
				? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`
				: ''
			const changefreq = entry.changeFrequency
				? `<changefreq>${entry.changeFrequency}</changefreq>`
				: ''
			const priority =
				entry.priority != null ? `<priority>${entry.priority}</priority>` : ''
			return `<url><loc>${entry.url}</loc>${lastmod}${changefreq}${priority}</url>`
		})
		.join('')

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
}
