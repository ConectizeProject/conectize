import { brands } from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'
import { SERVICES_HUB_PATH } from '@/lib/utils/services-hub'

export const SERVICES_HUB_LABEL = 'Conserto de Celular em BH'
export const ASSISTENCIA_IPHONE_PATH = '/assistencia-apple-bh'
export const CONSERTO_IPHONE_PATH = '/conserto-iphone-bh'
export const IPHONE_SCREEN_HUB_SLUG = 'troca-de-tela-apple-iphone'
export const IPHONE_REAR_GLASS_HUB_SLUG = 'troca-de-vidro-tampa-traseira-apple-iphone'
export const IPHONE_BATTERY_HUB_PATH = '/servicos/troca-de-bateria-apple-iphone'
export const IPHONE_SCREEN_HUB_PATH = `/servicos/${IPHONE_SCREEN_HUB_SLUG}`
export const IPHONE_GLASS_HUB_PATH = '/servicos/troca-de-vidro-da-tela-apple-iphone'
export const IPHONE_REAR_GLASS_HUB_PATH = `/servicos/${IPHONE_REAR_GLASS_HUB_SLUG}`

/** Modelos em destaque nos pilares (iPhone 11 ao 17 + XR). */
export const IPHONE_SEO_MODEL_SLUGS = [
	'iphone-17-pro-max',
	'iphone-17-pro',
	'iphone-17',
	'iphone-16-pro-max',
	'iphone-16-pro',
	'iphone-16',
	'iphone-15-pro-max',
	'iphone-15-pro',
	'iphone-15-plus',
	'iphone-15',
	'iphone-14-pro-max',
	'iphone-14-pro',
	'iphone-14-plus',
	'iphone-14',
	'iphone-13-pro-max',
	'iphone-13-pro',
	'iphone-13-mini',
	'iphone-13',
	'iphone-12-pro-max',
	'iphone-12-pro',
	'iphone-12-mini',
	'iphone-12',
	'iphone-11-pro-max',
	'iphone-11-pro',
	'iphone-11',
	'iphone-xr',
] as const

export function listIphoneSeoModels (serviceSlug: string) {
	const catalog = brands.apple?.deviceTypes?.iphone?.models || []
	return IPHONE_SEO_MODEL_SLUGS
		.filter((slug) => catalog.includes(slug))
		.map((slug) => ({
			slug,
			label: formatModelName(slug).replace(/\bXr\b/g, 'XR'),
			href: `/servicos/${buildServiceProductSlug({
				serviceSlug,
				brandSlug: 'apple',
				modelSlug: slug,
			})}`,
		}))
}

export function iphoneServiceHubHref (serviceSlug: string) {
	return `/servicos/${buildServiceProductSlug({
		serviceSlug,
		brandSlug: 'apple',
		modelSlug: 'iphone',
	})}`
}

export const IPHONE_PILLAR_LINKS = [
	{
		label: 'Assistência técnica iPhone',
		href: ASSISTENCIA_IPHONE_PATH,
		blurb: 'Visão geral dos reparos de iPhone em Belo Horizonte.',
	},
	{
		label: 'Conserto de iPhone',
		href: CONSERTO_IPHONE_PATH,
		blurb: 'Problemas comuns e o caminho até o reparo.',
	},
	{
		label: 'Troca de tela de iPhone',
		href: IPHONE_SCREEN_HUB_PATH,
		blurb: 'Display quebrado, manchas, linhas ou toque falhando.',
	},
	{
		label: 'Vidro traseiro de iPhone',
		href: IPHONE_REAR_GLASS_HUB_PATH,
		blurb: 'Tampa traseira trincada ou estilhaçada.',
	},
] as const

export function servicesHubBreadcrumb () {
	return { label: SERVICES_HUB_LABEL, href: SERVICES_HUB_PATH }
}
