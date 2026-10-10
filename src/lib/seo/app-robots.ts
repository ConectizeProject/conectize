import { APP_SITE_ORIGIN } from '@/lib/utils/site-url'

/**
 * robots.txt do host app.
 * Só /planos e /manual são públicos. Portal, login, OS e cadastro ficam de fora.
 */
export function buildAppRobotsTxt(): string {
	return [
		'User-agent: *',
		'Allow: /planos',
		'Allow: /manual/',
		'Disallow: /portal',
		'Disallow: /api/',
		'Disallow: /os/',
		'Disallow: /orcamento',
		'Disallow: /cadastro-empresa',
		'Disallow: /cadastro-cliente',
		'Disallow: /internal/',
		'',
		`Sitemap: ${APP_SITE_ORIGIN}/sitemap.xml`,
		'',
	].join('\n')
}
