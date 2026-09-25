import {
	ArrowLeft,
	ArrowRight,
	MapPin,
	MessageCircle,
	Phone,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { FreteCalculatorLazy } from '@/components/FreteCalculatorLazy'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { ClearServicosFiltersButton } from '@/components/services/ClearServicosFiltersButton'
import { ServicesFiltersLazy } from '@/components/services/ServicesFiltersLazy'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	buildWhatsAppUrl,
	business,
	getFaqPageJsonLd,
	getServiceJsonLd,
} from '@/lib/data/business'
import { brands, services } from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import { listServiceHubs } from '@/lib/utils/service-hubs'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'
import {
	buildServicesHubHref,
	SERVICES_HUB_PATH,
} from '@/lib/utils/services-hub'
import { getSiteUrl } from '@/lib/utils/site-url'
import { IPHONE_PILLAR_LINKS } from '@/lib/marketing/iphone-pillars'

type SearchParams = Promise<{
	marca?: string
	servico?: string
	dispositivo?: string
	modelo?: string
	page?: string
}>

const pageSize = 24
const pageHref = SERVICES_HUB_PATH
const canonical = `${getSiteUrl()}${pageHref}`

const landingSeo = {
	title: 'Conserto de Celular em Belo Horizonte | Conectize',
	description:
		'Conserto de celular em Belo Horizonte: troca de tela, bateria, vidro e reparos em placa. Assistência técnica especializada da Conectize em BH.',
	h1: 'Conserto de Celular em Belo Horizonte',
}

const landingFaq = [
	{
		q: 'Quais serviços de conserto de celular a Conectize realiza?',
		a: 'Realizamos troca de tela, troca de vidro da tela, troca de vidro/tampa traseira, troca de bateria, reparo de placa, troca de conector, reparo de câmera, reparo de áudio, correções de software e reparo de danos por água.',
	},
	{
		q: 'Quais marcas a Conectize atende em Belo Horizonte?',
		a: 'Atendemos Apple, Samsung, Xiaomi, Motorola e LG, além de assistência específica para produtos Apple como iPhone, iPad, MacBook e Apple Watch.',
	},
	{
		q: 'Como solicitar um orçamento?',
		a: 'Use os filtros desta página para chegar ao serviço e ao modelo, ou fale com a gente no WhatsApp. Passamos o orçamento antes de seguir com o reparo.',
	},
	{
		q: 'A Conectize faz coleta e entrega?',
		a: 'Sim. Há coleta e entrega em Belo Horizonte. Você também pode trazer o aparelho na loja da Santa Efigênia.',
	},
	{
		q: 'Onde fica a assistência técnica?',
		a: `Na Conectize, ${business.address.streetAddress}, ${business.address.neighborhood}, Belo Horizonte. Telefone ${business.phoneDisplay}.`,
	},
]

const quickFilters = [
	{
		label: 'Troca de vidro Apple Watch',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-vidro-da-tela', brandSlug: 'apple', modelSlug: 'watch' })}`,
	},
	{
		label: 'Troca de display do iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-tela', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Troca de conector de carga Samsung',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-conector', brandSlug: 'samsung', modelSlug: 'smartphone' })}`,
	},
	{
		label: 'Troca de bateria do iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-bateria', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Troca de bateria Samsung',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-bateria', brandSlug: 'samsung', modelSlug: 'smartphone' })}`,
	},
	{
		label: 'Troca de tela iPhone 17 Pro Max',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-tela', brandSlug: 'apple', modelSlug: 'iphone-17-pro-max' })}`,
	},
	{
		label: 'Troca de vidro do iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-vidro-da-tela', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Troca de vidro/tampa traseira do iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-vidro-tampa-traseira', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Troca de display Samsung Galaxy',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-tela', brandSlug: 'samsung', modelSlug: 'smartphone' })}`,
	},
	{
		label: 'Reparo de câmera do iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'troca-de-camera', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Reparo por água no iPhone',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'reparo-de-agua', brandSlug: 'apple', modelSlug: 'iphone' })}`,
	},
	{
		label: 'Correções de software MacBook',
		href: `/servicos/${buildServiceProductSlug({ serviceSlug: 'correcoes-de-software', brandSlug: 'apple', modelSlug: 'macbook' })}`,
	},
]

const attendanceSteps = [
	'Informe a marca, o modelo e o problema, pelo filtro desta página ou pelo WhatsApp.',
	'Avaliamos o aparelho e passamos o orçamento antes do reparo.',
	'Com a aprovação, seguimos com o serviço e testamos o aparelho.',
	'A devolução pode ser na loja ou por coleta e entrega em Belo Horizonte.',
]

function parsePage(value?: string) {
	const parsed = Number.parseInt(value || '1', 10)
	if (Number.isNaN(parsed) || parsed < 1) return 1
	return parsed
}

function getBrandBlocks() {
	return Object.values(brands).map((brand) => ({
		brand,
		services: services.filter((service) => service.brands.includes(brand.slug)),
	}))
}

function uniqueModelsForBrandAndService(
	brandSlug: string,
	serviceSlug: string,
	deviceTypeSlug?: string,
) {
	const brand = brands[brandSlug]
	const service = services.find((entry) => entry.slug === serviceSlug)
	if (!brand || !service) return []

	const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []
	const seen = new Set<string>()
	const models: string[] = []

	for (const deviceType of Object.values(brand.deviceTypes)) {
		if (excludedTypes.includes(deviceType.slug)) continue
		if (deviceTypeSlug && deviceType.slug !== deviceTypeSlug) continue
		for (const modelSlug of deviceType.models) {
			if (seen.has(modelSlug)) continue
			seen.add(modelSlug)
			models.push(modelSlug)
		}
	}

	return models
}

export async function generateMetadata({
	searchParams,
}: {
	searchParams: SearchParams
}): Promise<Metadata> {
	const { marca, servico, dispositivo, modelo } = await searchParams
	const selectedBrand = marca && brands[marca] ? brands[marca] : null
	const selectedService = servico
		? services.find((entry) => entry.slug === servico)
		: null
	const isFiltering = Boolean(marca || servico || dispositivo || modelo)

	const title = (() => {
		if (selectedBrand && selectedService && modelo) {
			return `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelo)} em Belo Horizonte | Conectize`
		}
		if (
			selectedBrand &&
			selectedService &&
			dispositivo &&
			selectedBrand.deviceTypes?.[dispositivo]
		) {
			return `${selectedService.name} ${selectedBrand.deviceTypes[dispositivo].displayName} ${selectedBrand.displayName} em Belo Horizonte | Conectize`
		}
		if (selectedBrand && selectedService) {
			return `${selectedService.name} ${selectedBrand.displayName} em Belo Horizonte | Conectize`
		}
		if (selectedBrand)
			return `Serviços para ${selectedBrand.displayName} em Belo Horizonte | Conectize`
		return landingSeo.title
	})()

	const description = isFiltering
		? 'Serviços especializados de reparo em Belo Horizonte. Filtre por marca, serviço, dispositivo e modelo para solicitar orçamento.'
		: landingSeo.description

	return {
		title,
		description,
		keywords:
			'conserto de celular em belo horizonte, conserto de celular bh, assistência técnica celular bh, assistência técnica celular em belo horizonte',
		robots: isFiltering
			? { index: false, follow: true }
			: { index: true, follow: true },
		alternates: {
			canonical,
		},
		openGraph: {
			title,
			description,
			url: canonical,
			type: 'website',
			locale: 'pt_BR',
		},
		twitter: {
			card: 'summary',
			title,
			description,
		},
	}
}

export default async function ConsertoCelularBeloHorizontePage({
	searchParams,
}: {
	searchParams: SearchParams
}) {
	const { marca, servico, dispositivo, modelo, page } = await searchParams
	const currentPage = parsePage(page)
	const selectedBrand = marca && brands[marca] ? brands[marca] : null
	const selectedService = servico
		? services.find((entry) => entry.slug === servico)
		: null
	const isFiltering = Boolean(marca || servico || dispositivo || modelo)
	const selectedDeviceType =
		selectedBrand && dispositivo
			? selectedBrand.deviceTypes?.[dispositivo]
			: null
	const whatsappHref = buildWhatsAppUrl(
		'Olá! Gostaria de um orçamento para conserto de celular em Belo Horizonte.',
	)
	const weekday = business.openingHours[0]
	const saturday = business.openingHours[1]

	const filterH1 = (() => {
		if (selectedBrand && selectedService && modelo) {
			return `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelo)}`
		}
		if (selectedBrand && selectedService && selectedDeviceType) {
			return `${selectedService.name} ${selectedDeviceType.displayName} ${selectedBrand.displayName}`
		}
		if (selectedBrand && selectedService) {
			return `${selectedService.name} ${selectedBrand.displayName}`
		}
		if (selectedBrand) return `Serviços para ${selectedBrand.displayName}`
		return null
	})()

	const results = (() => {
		if (selectedBrand && selectedService) {
			const deviceType =
				dispositivo && selectedBrand.deviceTypes?.[dispositivo]
					? dispositivo
					: undefined
			const modelSlugs = uniqueModelsForBrandAndService(
				selectedBrand.slug,
				selectedService.slug,
				deviceType,
			)
			const filtered = modelo
				? modelSlugs.filter((entry) => entry === modelo)
				: modelSlugs
			const total = filtered.length
			const totalPages = Math.max(1, Math.ceil(total / pageSize))
			const safePage = Math.min(currentPage, totalPages)
			const start = (safePage - 1) * pageSize
			const end = start + pageSize

			return {
				total,
				totalPages,
				currentPage: safePage,
				items: filtered.slice(start, end).map((modelSlug) => ({
					href: `/servicos/${buildServiceProductSlug({
						serviceSlug: selectedService.slug,
						brandSlug: selectedBrand.slug,
						modelSlug,
					})}`,
					title: `${selectedService.name} ${selectedBrand.displayName} ${formatModelName(modelSlug)}`,
					subtitle: 'Clique para ver detalhes e solicitar orçamento',
				})),
			}
		}

		const entries: Array<{ href: string; title: string; subtitle: string }> = []

		for (const service of services) {
			if (servico && service.slug !== servico) continue

			for (const brandSlug of service.brands) {
				if (marca && brandSlug !== marca) continue
				const brand = brands[brandSlug]
				if (!brand) continue
				const excludedTypes = service.excludedDeviceTypes?.[brandSlug] || []

				for (const deviceType of Object.values(brand.deviceTypes)) {
					if (excludedTypes.includes(deviceType.slug)) continue
					if (dispositivo && deviceType.slug !== dispositivo) continue

					for (const modelSlug of deviceType.models) {
						if (modelo && modelSlug !== modelo) continue
						entries.push({
							href: `/servicos/${buildServiceProductSlug({
								serviceSlug: service.slug,
								brandSlug,
								modelSlug,
							})}`,
							title: `${service.name} ${brand.displayName} ${formatModelName(modelSlug)}`,
							subtitle: `${deviceType.displayName} • Clique para ver detalhes e solicitar orçamento`,
						})
					}
				}
			}
		}

		const total = entries.length
		const totalPages = Math.max(1, Math.ceil(total / pageSize))
		const safePage = Math.min(currentPage, totalPages)
		const start = (safePage - 1) * pageSize
		const end = start + pageSize

		return {
			total,
			totalPages,
			currentPage: safePage,
			items: entries.slice(start, end),
		}
	})()

	const breadcrumbs = (() => {
		const items = [
			{ label: 'Home', href: '/' },
			{ label: 'Serviços', href: pageHref },
		]

		if (!isFiltering) {
			items.push({
				label: 'Conserto de Celular em Belo Horizonte',
				href: pageHref,
			})
			return items
		}

		if (selectedBrand) {
			items.push({
				label: selectedBrand.displayName,
				href: buildServicesHubHref({ marca: selectedBrand.slug }),
			})
		}
		if (selectedService) {
			items.push({
				label: selectedService.name,
				href: buildServicesHubHref({ marca, servico }),
			})
		}
		if (
			selectedBrand &&
			dispositivo &&
			selectedBrand.deviceTypes?.[dispositivo]
		) {
			items.push({
				label: selectedBrand.deviceTypes[dispositivo].displayName,
				href: buildServicesHubHref({ marca, servico, dispositivo }),
			})
		}
		if (modelo) {
			items.push({
				label: formatModelName(modelo),
				href: buildServicesHubHref({ marca, servico, dispositivo, modelo }),
			})
		}

		return items
	})()

	const serviceJsonLd = getServiceJsonLd({
		name: landingSeo.h1,
		description: landingSeo.description,
		serviceType: 'Conserto de celular',
		url: canonical,
	})

	function paginationHref(nextPage: number) {
		return buildServicesHubHref({
			marca,
			servico,
			dispositivo,
			modelo: selectedBrand && selectedService ? modelo : undefined,
			page: nextPage,
		})
	}

	return (
		<>
			{!isFiltering ? (
				<>
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
					/>
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: JSON.stringify(getFaqPageJsonLd(landingFaq)),
						}}
					/>
				</>
			) : null}

			<div className="min-h-screen pt-32 pb-20">
				<div className="container mx-auto px-4">
					<div className="grid gap-8 lg:grid-cols-[320px_1fr]">
						<aside className="lg:sticky lg:top-28 h-fit space-y-6">
							<ServicesFiltersLazy />

							<Card>
								<CardHeader>
									<CardTitle>Filtros rápidos</CardTitle>
									<CardDescription>
										Atalhos comuns para começar.
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									{quickFilters.map((item) => (
										<Button
											key={item.href}
											asChild
											variant="secondary"
											size="sm"
										>
											<Link href={item.href}>{item.label}</Link>
										</Button>
									))}
								</CardContent>
							</Card>

							<div className="bg-card rounded-xl border border-border p-6">
								<h2 className="text-xl font-bold text-foreground mb-4">
									Calcule a coleta por CEP
								</h2>
								<FreteCalculatorLazy />
							</div>

							<Card className="bg-primary/10">
								<CardHeader>
									<CardTitle>Solicite um orçamento</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="text-sm text-muted-foreground">
										Informe a marca e o modelo do aparelho. Respondemos com o
										orçamento do reparo.
									</p>
									<div className="flex flex-col gap-3">
										<a
											href={whatsappHref}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
										>
											<MessageCircle className="w-5 h-5" />
											Solicitar orçamento
										</a>
										<a
											href={`tel:${business.phone}`}
											className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
										>
											<Phone className="w-5 h-5" />
											Ligar Agora
										</a>
									</div>
								</CardContent>
							</Card>
						</aside>

						<main>
							<Breadcrumbs items={breadcrumbs} />

							<header className="mb-8">
								<h1 className="inline-block text-4xl md:text-5xl font-bold text-foreground mb-4 mt-4">
									{isFiltering && filterH1 ? filterH1 : landingSeo.h1}
								</h1>
								{!isFiltering ? (
									<p className="text-lg text-muted-foreground max-w-3xl">
										A Conectize realiza assistência técnica e conserto de
										celulares em Belo Horizonte. Avaliamos o aparelho, passamos
										o orçamento e seguimos com o reparo na loja da Santa
										Efigênia ou com coleta e entrega na cidade.
									</p>
								) : null}
							</header>

							{!isFiltering ? (
								<>
									<section className="bg-card rounded-xl p-8 mb-12 border border-border">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											iPhone em Belo Horizonte: páginas em destaque
										</h2>
										<p className="text-muted-foreground mb-6">
											Guias focados em assistência e conserto de iPhone, troca
											de tela e vidro traseiro.
										</p>
										<ul className="grid sm:grid-cols-2 gap-4">
											{IPHONE_PILLAR_LINKS.map((pillar) => (
												<li key={pillar.href}>
													<Link
														href={pillar.href}
														className="block h-full rounded-xl border border-border bg-secondary/30 p-5 hover:bg-secondary/40 transition-colors"
													>
														<span className="font-semibold text-foreground">
															{pillar.label}
														</span>
														<span className="mt-2 block text-sm text-muted-foreground">
															{pillar.blurb}
														</span>
														<span className="mt-3 inline-block text-sm font-medium text-primary">
															Abrir →
														</span>
													</Link>
												</li>
											))}
										</ul>
									</section>

									<section className="bg-card rounded-xl p-8 mb-12 border border-border">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											Conserto e Assistência Técnica de Celulares
										</h2>
										<p className="text-muted-foreground mb-4">
											Atendemos celulares e aparelhos Apple com diagnóstico,
											orçamento e reparo. Use os filtros ao lado para chegar ao
											serviço e ao modelo, ou escolha uma marca abaixo.
										</p>
										<ul className="grid sm:grid-cols-2 gap-3">
											{services.map((service) => (
												<li key={service.slug}>
													<Link
														href={buildServicesHubHref({
															servico: service.slug,
														})}
														className="block rounded-lg border border-border bg-secondary/30 px-4 py-3 hover:bg-secondary/40"
													>
														<span className="font-semibold text-foreground">
															{service.name}
														</span>
														<span className="mt-1 block text-sm text-muted-foreground">
															{service.shortDescription}
														</span>
													</Link>
												</li>
											))}
										</ul>
									</section>

									<section className="mb-12">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											Principais Serviços
										</h2>
										<p className="text-muted-foreground mb-6">
											Cada serviço leva aos aparelhos e modelos que atendemos.
										</p>
										<ul className="flex flex-wrap gap-2">
											{services.map((service) => (
												<li key={`chip-${service.slug}`}>
													<Button asChild variant="secondary" size="sm">
														<Link
															href={buildServicesHubHref({
																servico: service.slug,
															})}
														>
															{service.name}
														</Link>
													</Button>
												</li>
											))}
										</ul>
									</section>

									<section
										aria-label="Serviços por marca"
										className="space-y-10 mb-12"
									>
										<h2 className="text-2xl font-bold text-foreground">
											Conserto de Celular por Marca
										</h2>
										{getBrandBlocks().map(
											({ brand, services: brandServices }) => (
												<Card key={brand.slug} className="border border-border">
													<CardHeader className="pb-4">
														<div className="flex items-end justify-between gap-4 flex-wrap">
															<div>
																<CardTitle className="text-2xl">
																	{brand.displayName}
																</CardTitle>
																<CardDescription>
																	Escolha o serviço e o tipo de aparelho para
																	ver todos os modelos.
																</CardDescription>
															</div>
															<Button asChild variant="outline" size="sm">
																<Link
																	href={buildServicesHubHref({
																		marca: brand.slug,
																	})}
																>
																	Ver {brand.displayName}
																</Link>
															</Button>
														</div>
													</CardHeader>
													<CardContent className="space-y-6">
														{brandServices.map((service) => {
															const hubs = listServiceHubs({
																brandSlug: brand.slug,
																serviceSlug: service.slug,
															})
															if (hubs.length === 0) return null

															return (
																<div key={`${brand.slug}-${service.slug}`}>
																	<h3 className="font-semibold text-foreground mb-1">
																		{service.name}
																	</h3>
																	<p className="text-sm text-muted-foreground mb-3">
																		{service.shortDescription}
																	</p>
																	<ul className="flex flex-wrap gap-2">
																		{hubs.map((hub) => (
																			<li key={hub.href}>
																				<Button
																					asChild
																					variant="secondary"
																					size="sm"
																				>
																					<Link href={hub.href}>
																						{hub.deviceTypeName}
																					</Link>
																				</Button>
																			</li>
																		))}
																	</ul>
																</div>
															)
														})}
													</CardContent>
												</Card>
											),
										)}
									</section>

									<section className="bg-card rounded-xl p-8 mb-12 border border-border">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											Assistência Técnica em Belo Horizonte
										</h2>
										<p className="text-muted-foreground mb-4">
											O atendimento é em BH, na loja ou com coleta e entrega.
											Traga o aparelho ou chame no WhatsApp para combinar a
											retirada.
										</p>
										<div className="flex items-start gap-3 text-muted-foreground">
											<MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
											<div>
												<p className="font-medium text-foreground mb-1">
													Conectize
												</p>
												<p>
													{business.address.streetAddress} -{' '}
													{business.address.neighborhood}
												</p>
												<p>
													{business.address.addressLocality} -{' '}
													{business.address.addressRegion},{' '}
													{business.address.postalCode}
												</p>
												<p className="mt-2">
													{weekday.label}: {weekday.display}
												</p>
												<p>
													{saturday.label}: {saturday.display}
												</p>
												<p className="mt-2">
													<a
														href={`tel:${business.phone}`}
														className="text-primary hover:underline"
													>
														{business.phoneDisplay}
													</a>
												</p>
												<p className="mt-2">
													<a
														href={business.hasMap}
														target="_blank"
														rel="noopener noreferrer"
														className="text-primary hover:underline"
													>
														Como chegar
													</a>
												</p>
											</div>
										</div>
									</section>

									<section className="bg-card rounded-xl p-8 mb-12 border border-border">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											Como funciona o atendimento
										</h2>
										<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
											{attendanceSteps.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ol>
									</section>

									<section className="bg-card rounded-xl p-8 border border-border">
										<h2 className="text-2xl font-bold text-foreground mb-4">
											Perguntas Frequentes
										</h2>
										<div className="space-y-6">
											{landingFaq.map((item) => (
												<div key={item.q}>
													<h3 className="text-lg font-semibold text-foreground mb-2">
														{item.q}
													</h3>
													<p className="text-muted-foreground">{item.a}</p>
												</div>
											))}
										</div>
									</section>
								</>
							) : (
								<section aria-label="Resultados" className="space-y-4 mt-10">
									<div className="flex items-end justify-between gap-4 flex-wrap">
										<div>
											<h2 className="text-2xl font-bold text-foreground">
												Resultados
											</h2>
											<p className="text-sm text-muted-foreground">
												{selectedBrand && selectedService ? (
													<>
														Mostrando modelos para <b>{selectedService.name}</b>{' '}
														em <b>{selectedBrand.displayName}</b>
													</>
												) : (
													'Mostrando todas as opções disponíveis. Use os filtros para refinar.'
												)}
											</p>
										</div>
										{(marca || servico || dispositivo || modelo) && (
											<ClearServicosFiltersButton />
										)}
									</div>

									{results.items.length === 0 ? (
										<Card>
											<CardHeader>
												<CardTitle>Nenhum resultado encontrado</CardTitle>
												<CardDescription>
													Ajuste os filtros ou limpe para ver todas as páginas
													disponíveis.
												</CardDescription>
											</CardHeader>
										</Card>
									) : (
										<>
											<div className="flex items-center justify-between gap-3 flex-wrap">
												<p className="text-sm text-muted-foreground">
													{results.total} resultados • Página{' '}
													{results.currentPage} de {results.totalPages}
												</p>
												{results.totalPages > 1 && (
													<div className="flex items-center gap-2">
														{results.currentPage <= 1 ? (
															<Button
																variant="outline"
																size="sm"
																disabled
																aria-disabled="true"
																className="text-muted-foreground border-border/50 bg-muted/20"
															>
																<span className="sr-only">Anterior</span>
																<ArrowLeft className="w-4 h-4" />
															</Button>
														) : (
															<Button asChild variant="outline" size="sm">
																<Link
																	href={paginationHref(
																		Math.max(1, results.currentPage - 1),
																	)}
																	aria-label="Página anterior"
																>
																	<span className="sr-only">Anterior</span>
																	<ArrowLeft className="w-4 h-4" />
																</Link>
															</Button>
														)}
														{results.currentPage >= results.totalPages ? (
															<Button
																variant="outline"
																size="sm"
																disabled
																aria-disabled="true"
																className="text-muted-foreground border-border/50 bg-muted/20"
															>
																<span className="sr-only">Próxima</span>
																<ArrowRight className="w-4 h-4" />
															</Button>
														) : (
															<Button asChild variant="outline" size="sm">
																<Link
																	href={paginationHref(
																		Math.min(
																			results.totalPages,
																			results.currentPage + 1,
																		),
																	)}
																	aria-label="Próxima página"
																>
																	<span className="sr-only">Próxima</span>
																	<ArrowRight className="w-4 h-4" />
																</Link>
															</Button>
														)}
													</div>
												)}
											</div>

											<ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
												{results.items.map((item) => (
													<li key={item.href}>
														<Link
															href={item.href}
															className="block bg-card rounded-xl p-6 shadow-card hover:shadow-glow transition-all duration-300 border border-border hover:border-primary/50"
														>
															<h3 className="text-lg font-bold text-foreground mb-2">
																{item.title}
															</h3>
															<p className="text-muted-foreground text-sm mb-4">
																{item.subtitle}
															</p>
															<span className="text-primary text-sm font-medium hover:underline">
																Ver detalhes →
															</span>
														</Link>
													</li>
												))}
											</ul>
										</>
									)}
								</section>
							)}
						</main>
					</div>
				</div>
			</div>
		</>
	)
}
