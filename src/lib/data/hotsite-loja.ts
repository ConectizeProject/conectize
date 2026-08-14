import { buildWhatsAppUrl, business } from '@/lib/data/business'
import { getSiteUrl } from '@/lib/utils/site-url'

export const lojaPath = '/loja'

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
	heroLine: 'Peças e',
	heroShine: 'acessórios.',
	heroLead:
		'Telas, baterias, capinhas e películas para iPhone, Android e tablets. Orçamento no WhatsApp.',
	disclaimer:
		'A Conectize é uma loja independente. Não somos Apple, Samsung nem autorizados oficiais. As marcas citadas pertencem aos respectivos fabricantes.',
} as const

export const lojaWhatsAppHref = buildWhatsAppUrl(lojaCopy.whatsappMessage)

export const lojaNav = [
	{ href: '#cena', label: 'Antes e depois' },
	{ href: '#produtos', label: 'Produtos' },
	{ href: '#linhas', label: 'Linhas' },
	{ href: '#diferenciais', label: 'Diferenciais' },
	{ href: '#unidade', label: 'Loja' },
	{ href: '#contato', label: 'Contato' },
] as const

export const lojaProducts = [
	{
		title: 'Telas e displays',
		description:
			'Displays para diversos modelos de iPhone e Android, com opções para você escolher o melhor custo-benefício.',
	},
	{
		title: 'Baterias',
		description:
			'Baterias novas para celular e tablet, prontas para o seu modelo. Peça o orçamento com o nome do aparelho.',
	},
	{
		title: 'Capinhas',
		description:
			'Proteção para o dia a dia, com modelos transparentes, coloridos e reforçados.',
	},
	{
		title: 'Películas',
		description:
			'Películas de vidro temperado para manter a tela protegida contra riscos e impactos leves.',
	},
	{
		title: 'Carregadores e cabos',
		description:
			'Fontes, cabos USB-C e Lightning, e kits de carga para usar na mesa, no carro ou na viagem.',
	},
	{
		title: 'Áudio e extras',
		description:
			'Fones, adaptadores e acessórios para completar o aparelho sem surpresa na hora de pagar.',
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
