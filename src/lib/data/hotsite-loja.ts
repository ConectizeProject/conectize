import { business } from '@/lib/data/business'
import { getSiteUrl } from '@/lib/utils/site-url'

export const lojaPath = '/loja'

export const lojaCategoryPaths = {
	telas: '/loja/telas-displays',
	vidroFrontal: '/loja/vidro-frontal',
	bateria: '/loja/bateria-iphone',
	vidro: '/loja/vidro-traseiro-iphone',
	capinhas: '/loja/capinhas',
	peliculas: '/loja/peliculas',
	carregadores: '/loja/carregadores-e-cabos',
	audio: '/loja/audio-e-extras',
	acessorios: '/loja/acessorios',
} as const

/** Modelos com peça ou acessório na loja. Sem mini, SE, 16e ou 17 Air. */
export const iphoneModels = [
	'iPhone 11',
	'iPhone 11 Pro',
	'iPhone 11 Pro Max',
	'iPhone 12',
	'iPhone 12 Pro',
	'iPhone 12 Pro Max',
	'iPhone 13',
	'iPhone 13 Pro',
	'iPhone 13 Pro Max',
	'iPhone 14',
	'iPhone 14 Plus',
	'iPhone 14 Pro',
	'iPhone 14 Pro Max',
	'iPhone 15',
	'iPhone 15 Plus',
	'iPhone 15 Pro',
	'iPhone 15 Pro Max',
	'iPhone 16',
	'iPhone 16 Plus',
	'iPhone 16 Pro',
	'iPhone 16 Pro Max',
	'iPhone 17',
	'iPhone 17 Pro',
	'iPhone 17 Pro Max',
] as const

export const lojaCategoryAddress = {
	streetAddress: 'R. Padre Rolim, 620',
	neighborhood: 'Santa Efigênia',
	addressLocality: 'Belo Horizonte',
	addressRegion: 'MG',
	postalCode: '30130-094',
} as const

export const lojaPickupAnswer =
	'Sim. Estamos na R. Padre Rolim, 620, Santa Efigênia. Confirme a disponibilidade pelo WhatsApp antes de vir.'

export const lojaIndependentAnswer =
	'Não. Somos uma loja independente em Belo Horizonte.'

export function whatsappLink (message: string) {
	return `https://wa.me/5531986140889?text=${encodeURIComponent(message)}`
}

export const lojaCopy = {
	brand: 'Conectize Store',
	title:
		'Loja de peças e acessórios para celular em Belo Horizonte | Conectize',
	description:
		'Loja física em Belo Horizonte com peças, telas, baterias, capinhas, películas e carregadores para iPhone, Android e tablets. Orçamento pelo WhatsApp.',
	keywords:
		'loja de celular belo horizonte, pecas iphone bh, acessorios celular bh, pelicula celular bh, capinha iphone bh, bateria celular bh, tela celular bh, carregador iphone bh',
	whatsappMessage:
		'Olá! Quero um orçamento de peças e acessórios para o meu aparelho.',
	heroIntro: 'Loja em Santa Efigênia, Belo Horizonte.',
	heroLine: 'Quebrou?',
	heroShine: 'Você está no lugar certo.',
	heroLead:
		'Telas, baterias e acessórios. Orçamento no WhatsApp.',
	disclaimer:
		'A Conectize é uma loja independente. Não somos Apple, Samsung nem autorizados oficiais. As marcas citadas pertencem aos respectivos fabricantes.',
} as const

export const lojaWhatsAppHref = whatsappLink(lojaCopy.whatsappMessage)

export const lojaNav = [
	{ href: '#produtos', label: 'Produtos' },
	{ href: '#linhas', label: 'Linhas' },
	{ href: '#diferenciais', label: 'Diferenciais' },
	{ href: '#avaliacoes', label: 'Avaliações' },
	{ href: '#unidade', label: 'Loja' },
	{ href: '#contato', label: 'Contato' },
] as const

export const lojaGoogleRating = {
	ratingValue: 5,
	reviewCountLabel: 'mais de 400',
	reviewCount: 400,
	sourceLabel: 'Google',
	mapsUrl: business.hasMap,
} as const

export const lojaTestimonials = [
	{
		name: 'Camila R.',
		quote:
			'Cheguei com o iPhone sem tela e saí no mesmo dia com a peça certa e o preço combinado. Atendimento direto, sem enrolação.',
	},
	{
		name: 'Rafael M.',
		quote:
			'Mandei o modelo no WhatsApp, me passaram as opções de bateria e capinha e eu escolhi. Honestidade no orçamento faz toda a diferença.',
	},
	{
		name: 'Juliana S.',
		quote:
			'Já levei película, cabo e display. Sempre explicam o que estou comprando e a garantia. Por isso volto e indico.',
	},
] as const

export const lojaProducts = [
	{
		title: 'Telas e displays',
		description:
			'Displays para diversos modelos de iPhone e Android, com opções para você escolher o melhor custo-benefício.',
		href: lojaCategoryPaths.telas,
	},
	{
		title: 'Vidro frontal',
		description:
			'Vidro frontal do display para iPhone. Peça nova, com pronta entrega na loja em Santa Efigênia.',
		href: lojaCategoryPaths.vidroFrontal,
	},
	{
		title: 'Baterias',
		description:
			'Baterias novas para celular e tablet, prontas para o seu modelo. Peça o orçamento com o nome do aparelho.',
		href: lojaCategoryPaths.bateria,
	},
	{
		title: 'Vidro traseiro',
		description:
			'Vidro traseiro, também chamado de tampa traseira, para iPhone. Peça nova, com pronta entrega na loja.',
		href: lojaCategoryPaths.vidro,
	},
	{
		title: 'Capinhas',
		description:
			'Proteção para o dia a dia, com modelos transparentes, coloridos e reforçados.',
		href: lojaCategoryPaths.capinhas,
	},
	{
		title: 'Películas',
		description:
			'Películas de vidro temperado para manter a tela protegida contra riscos e impactos leves.',
		href: lojaCategoryPaths.peliculas,
	},
	{
		title: 'Carregadores e cabos',
		description:
			'Fontes, cabos USB-C e Lightning, e kits de carga para usar na mesa, no carro ou na viagem.',
		href: lojaCategoryPaths.carregadores,
	},
	{
		title: 'Áudio e extras',
		description:
			'Fones, adaptadores e acessórios para completar o aparelho sem surpresa na hora de pagar.',
		href: lojaCategoryPaths.audio,
	},
	{
		title: 'Acessórios',
		description:
			'Capinhas, películas, carregadores e cabos para iPhone e Android, com pronta entrega.',
		href: lojaCategoryPaths.acessorios,
	},
] as const

export const lojaLines = [
	{
		title: 'Linha iPhone',
		description:
			'Peças e acessórios para iPhone, iPad, Apple Watch e Mac. Informe o modelo e receba as opções em estoque.',
	},
	{
		title: 'Linha Android',
		description:
			'Itens para Samsung, Motorola, Xiaomi e outras marcas. A gente confirma compatibilidade antes de separar o pedido.',
	},
	{
		title: 'Tablets',
		description:
			'Películas, capinhas, canetas e peças para tablets. Ideal para quem usa o aparelho no trabalho ou no estudo.',
	},
] as const

export const lojaHighlights = [
	{
		title: 'Loja física, atendimento humano',
		description:
			'Você fala com quem está na loja. Sem script remoto, sem pressão e sem letra miúda escondida.',
	},
	{
		title: 'Você escolhe a peça',
		description:
			'Explicamos as opções de qualidade e preço. A decisão fica com você, com clareza no orçamento.',
	},
	{
		title: 'Estoque para o dia a dia',
		description:
			'Telas, baterias e acessórios dos modelos mais pedidos em Belo Horizonte, para resolver na hora sempre que houver disponibilidade.',
	},
	{
		title: 'Garantia nos produtos',
		description:
			'Itens adquiridos na loja saem com garantia conforme o produto. Combinamos prazo e cobertura na hora da compra.',
	},
] as const

export const lojaFaq = [
	{
		q: 'Como peço um orçamento?',
		a: 'Chame no WhatsApp com o modelo do aparelho e o que você procura: tela, bateria, película, capinha ou carregador. Respondemos com as opções e o valor.',
	},
	{
		q: 'A Conectize é loja oficial da Apple ou Samsung?',
		a: 'Não. Somos uma loja independente em Belo Horizonte. Não representamos fabricantes e as marcas citadas pertencem a eles.',
	},
	{
		q: 'Vocês têm loja física?',
		a: `Sim. Estamos na ${business.address.full}. Você pode retirar na loja ou combinar o melhor horário pelo WhatsApp.`,
	},
	{
		q: 'Qual o horário de atendimento?',
		a:
			business.openingHours
				.map((item) => `${item.label}, ${item.display}`)
				.join('. ') + '.',
	},
	{
		q: 'As peças e acessórios têm garantia?',
		a: 'Sim. A garantia acompanha o produto vendido e é confirmada no orçamento, antes de você fechar.',
	},
] as const

export function getLojaJsonLd() {
	const siteUrl = getSiteUrl()
	const pageUrl = `${siteUrl}${lojaPath}`
	const logoUrl = `${siteUrl}${business.logoPath}`

	return {
		'@context': 'https://schema.org',
		'@type': 'ElectronicsStore',
		'@id': `${pageUrl}#store`,
		name: lojaCopy.brand,
		legalName: business.legalName,
		image: logoUrl,
		logo: logoUrl,
		description: lojaCopy.description,
		url: pageUrl,
		telephone: business.phone,
		email: business.email,
		priceRange: business.priceRange,
		hasMap: business.hasMap,
		sameAs: business.sameAs,
		address: {
			'@type': 'PostalAddress',
			streetAddress: business.address.streetAddress,
			addressLocality: business.address.addressLocality,
			addressRegion: business.address.addressRegion,
			postalCode: business.address.postalCode,
			addressCountry: business.address.addressCountry,
		},
		geo: {
			'@type': 'GeoCoordinates',
			latitude: business.geo.latitude,
			longitude: business.geo.longitude,
		},
		openingHoursSpecification: business.openingHours.map((item) => ({
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: item.dayOfWeek,
			opens: item.opens,
			closes: item.closes,
		})),
		contactPoint: {
			'@type': 'ContactPoint',
			telephone: business.phone,
			contactType: 'sales',
			availableLanguage: 'Portuguese',
		},
		areaServed: {
			'@type': 'City',
			name: 'Belo Horizonte',
			addressRegion: 'MG',
			addressCountry: 'BR',
		},
		aggregateRating: {
			'@type': 'AggregateRating',
			ratingValue: lojaGoogleRating.ratingValue,
			bestRating: 5,
			worstRating: 1,
			ratingCount: lojaGoogleRating.reviewCount,
		},
		hasOfferCatalog: {
			'@type': 'OfferCatalog',
			name: 'Peças e acessórios Conectize Store',
			itemListElement: lojaProducts.map((product) => ({
				'@type': 'Offer',
				itemOffered: {
					'@type': 'Product',
					name: product.title,
					description: product.description,
				},
			})),
		},
	}
}

export function getLojaCategoryStoreJsonLd (input: {
	path: string
	description: string
}) {
	const pageUrl = `${getSiteUrl()}${input.path}`

	return {
		'@context': 'https://schema.org',
		'@type': 'Store',
		name: business.name,
		legalName: 'Conectize Store Ltda.',
		description: input.description,
		url: pageUrl,
		telephone: business.phone,
		address: {
			'@type': 'PostalAddress',
			streetAddress: lojaCategoryAddress.streetAddress,
			addressLocality: lojaCategoryAddress.addressLocality,
			addressRegion: lojaCategoryAddress.addressRegion,
			postalCode: lojaCategoryAddress.postalCode,
			addressCountry: 'BR',
		},
		openingHoursSpecification: business.openingHours.map((item) => ({
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: item.dayOfWeek,
			opens: item.opens,
			closes: item.closes,
		})),
	}
}

export function getLojaCategoryFaqJsonLd (
	items: readonly { q: string; a: string }[],
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.a,
			},
		})),
	}
}

export function getLojaFaqJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: lojaFaq.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.a,
			},
		})),
	}
}
