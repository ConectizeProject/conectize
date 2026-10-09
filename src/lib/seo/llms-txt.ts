import { business } from '@/lib/data/business'
import { services } from '@/lib/data/services'
import { googleReviews, serviceWarranty } from '@/lib/data/site-facts'
import { preferredPublicServiceHref } from '@/lib/utils/canonical-service-path'
import { absoluteSiteUrl } from '@/lib/utils/site-url'

function formatWhatsApp (e164: string) {
	const digits = e164.replace(/\D/g, '')
	if (digits.length !== 13 || !digits.startsWith('55')) return e164
	const ddd = digits.slice(2, 4)
	const local = digits.slice(4)
	return `+55 ${ddd} ${local.slice(0, 5)}-${local.slice(5)}`
}

function hourRange (opens: string, closes: string) {
	const compact = (value: string) =>
		value.endsWith(':00') ? value.slice(0, 2) : value
	return `${compact(opens)}-${compact(closes)}`
}

const mainPages = [
	{ href: '/', label: 'Início', note: 'Assistência técnica de celular em Belo Horizonte' },
	{ href: '/assistencia-tecnica-celular-bh', label: 'Assistência técnica de celular em BH', note: 'Android e Apple, com coleta' },
	{ href: '/assistencia-apple-bh', label: 'Assistência Apple em BH', note: 'iPhone, iPad, MacBook e Apple Watch' },
	{ href: '/conserto-iphone-bh', label: 'Conserto de iPhone em BH', note: 'Tela, bateria, carga, câmera e placa' },
	{ href: '/conserto-de-celular-belo-horizonte', label: 'Conserto de celular em Belo Horizonte', note: 'Catálogo de serviços por marca e modelo' },
	{ href: '/troca-de-tela-celular-bh', label: 'Troca de tela de celular em BH', note: 'iPhone, Samsung, Xiaomi, Motorola e LG' },
	{ href: '/coleta', label: 'Coleta em domicílio', note: 'Coleta e entrega em Belo Horizonte' },
	{ href: '/loja', label: 'Loja de peças e acessórios', note: 'Telas, baterias, capinhas, películas e carregadores' },
	{ href: '/acessorios', label: 'Acessórios', note: 'Acessórios para celular' },
	{ href: '/sobre', label: 'Sobre a Conectize', note: 'Oficina em Santa Efigênia' },
	{ href: '/contato', label: 'Contato', note: 'WhatsApp, e-mail e endereço' },
	{ href: '/lojistas', label: 'Lojistas', note: 'Condições para revenda' },
] as const

export function buildLlmsTxt () {
	const weekday = business.openingHours[0]
	const saturday = business.openingHours[1]
	const address = `${business.address.streetAddress}, ${business.address.neighborhood}, ${business.address.addressLocality}-${business.address.addressRegion}, ${business.address.postalCode}`
	const hours = `${weekday.shortLabel.toLowerCase()} ${hourRange(weekday.opens, weekday.closes)}, ${saturday.shortLabel.toLowerCase()} ${hourRange(saturday.opens, saturday.closes)}`

	const serviceLines = services.map((service) => {
		const href = absoluteSiteUrl(preferredPublicServiceHref(service.slug))
		return `- [${service.name}](${href}): ${service.shortDescription}. ${serviceWarranty.serviceAndPart}`
	})

	const pageLines = mainPages.map((page) => {
		return `- [${page.label}](${absoluteSiteUrl(page.href)}): ${page.note}.`
	})

	return [
		'# Conectize',
		'',
		'> Assistência técnica especializada em iPhone, também Samsung, Xiaomi, Motorola, iPad, Apple Watch e MacBook. Loja de acessórios em Belo Horizonte.',
		'',
		`A Conectize é uma assistência técnica em Belo Horizonte, especializada em conserto de iPhone, e também atende Samsung, Xiaomi, Motorola, iPad, Apple Watch e MacBook. A loja vende peças e acessórios. Há coleta em Belo Horizonte. Todos os serviços têm ${serviceWarranty.phrase}.`,
		'',
		'## Contato',
		'',
		`- Endereço: ${address}`,
		`- WhatsApp: ${formatWhatsApp(business.phone)}`,
		`- E-mail: ${business.email}`,
		`- Horário: ${hours}`,
		'',
		'## Avaliações',
		'',
		`${googleReviews.homeLine}.`,
		'',
		'## Serviços',
		'',
		...serviceLines,
		`- Coleta em domicílio em Belo Horizonte: ${absoluteSiteUrl('/coleta')}`,
		`- ${serviceWarranty.includedItem}.`,
		'',
		'## Páginas',
		'',
		...pageLines,
		'',
	].join('\n')
}
