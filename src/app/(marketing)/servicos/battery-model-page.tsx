import { MapPin, MessageCircle, Phone } from 'lucide-react'
import Link from 'next/link'
import { FreteCalculatorLazy } from '@/components/FreteCalculatorLazy'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	buildWhatsAppUrl,
	business,
	getFaqPageJsonLd,
	getServiceJsonLd,
} from '@/lib/data/business'
import {
	getBrandBySlug,
	getModelBySlugAnyType,
	getServiceBySlug,
} from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import {
	buildServiceProductSlug,
	parseServiceProductSlug,
} from '@/lib/utils/service-product-slug'
import { getSiteUrl } from '@/lib/utils/site-url'

const relatedServiceSlugs = [
	'troca-de-tela',
	'troca-de-vidro-da-tela',
	'troca-de-camera',
	'reparo-de-placa',
	'troca-de-conector',
	'reparo-de-audio',
] as const

export type BatteryModelFaq = { q: string; a: string }

export type BatteryModelLanding = {
	slug: string
	name: string
	hubHref: string
	hubLabel: string
	hubLinkLabel: string
	pageHref: string
	seo: { title: string; description: string; h1: string }
	intro: string
	signs: string[]
	steps: string[]
	faq: BatteryModelFaq[]
	siblingsHeading: string | null
	siblings: Array<{ href: string; label: string }>
	related: Array<{ href: string; label: string }>
	whatsappMessage: string
}

function batteryModelLabel(slug: string) {
	return formatModelName(slug)
		.replace(/\bSe\b/g, 'SE')
		.replace(/\bXs\b/g, 'XS')
		.replace(/\bXr\b/g, 'XR')
		.replace(/\bMini\b/g, 'mini')
}

function iphoneGenerationKey(slug: string) {
	if (!slug.startsWith('iphone-')) return null
	const head = slug.slice('iphone-'.length).split('-')[0]
	return head || null
}

function iphoneFamilyLabel(generation: string) {
	if (generation === 'se') return 'iPhone SE'
	if (generation === 'xs') return 'iPhone XS'
	if (generation === 'xr') return 'iPhone XR'
	if (generation === 'x') return 'iPhone X'
	return `iPhone ${generation}`
}

function signsFor(name: string, isApple: boolean) {
	return [
		`A autonomia caiu rápido, mesmo com o ${name} em repouso.`,
		'O aparelho desliga com a porcentagem ainda alta.',
		'Esquenta ao carregar.',
		isApple
			? 'A saúde da bateria aparece muito baixa e o consumo dispara.'
			: 'A porcentagem cai de repente durante o uso.',
		'A carga trava e não passa de uma certa porcentagem.',
		'A bateria inchou e pressiona a tela ou a carcaça. Nesse caso, evite forçar o aparelho.',
	]
}

function stepsFor(name: string, isApple: boolean) {
	return [
		'Avaliamos o consumo e o comportamento da carga.',
		isApple
			? 'Removemos a bateria com as tiras adesivas.'
			: 'Removemos a bateria com segurança.',
		`Instalamos a bateria compatível com o ${name}.`,
		'Testamos carga, aquecimento e estabilidade.',
	]
}

function faqFor(name: string): BatteryModelFaq[] {
	return [
		{
			q: `Quando devo trocar a bateria do ${name}?`,
			a: 'Quando a autonomia caiu muito, o aparelho desliga com porcentagem alta, esquenta na carga, a carga trava ou a bateria está inchada.',
		},
		{
			q: `Quanto custa trocar a bateria do ${name}?`,
			a: `Clique em Solicitar orçamento e fale com a gente no WhatsApp. Fazemos o orçamento da troca de bateria do seu ${name}.`,
		},
		{
			q: 'A troca da bateria apaga meus dados?',
			a: 'A troca é de hardware e não exige formatação. Mesmo assim, faça backup antes de deixar o aparelho.',
		},
		{
			q: 'Quanto tempo demora?',
			a: 'Em geral, a troca da bateria fica pronta em até 24 horas úteis. O prazo é confirmado no orçamento.',
		},
		{
			q: 'A bateria possui garantia?',
			a: 'Sim. A troca de bateria tem garantia de 12 meses, para defeito de fabricação da peça e problema relacionado à instalação.',
		},
		{
			q: `Onde trocar a bateria do ${name} em Belo Horizonte?`,
			a: 'Na Conectize, R. Padre Rolim, 620, Santa Efigênia. Também há coleta e entrega em Belo Horizonte.',
		},
	]
}

export function resolveBatteryModelLanding(
	slug: string,
): BatteryModelLanding | null {
	const parsed = parseServiceProductSlug(slug)
	if (!parsed.isValid || parsed.serviceSlug !== 'troca-de-bateria') return null

	const brand = getBrandBySlug(parsed.brandSlug)
	if (!brand) return null
	if (brand.deviceTypes?.[parsed.modelSlug]) return null

	const modelData = getModelBySlugAnyType(parsed.brandSlug, parsed.modelSlug)
	if (!modelData) return null

	const service = getServiceBySlug('troca-de-bateria')
	const excluded = service?.excludedDeviceTypes?.[brand.slug] || []
	if (excluded.includes(modelData.deviceType.slug)) return null

	const name = batteryModelLabel(modelData.modelSlug)
	const isApple = brand.slug === 'apple'
	const isIphone = isApple && modelData.deviceType.slug === 'iphone'
	const hubHref = `/servicos/${buildServiceProductSlug({
		serviceSlug: 'troca-de-bateria',
		brandSlug: brand.slug,
		modelSlug: modelData.deviceType.slug,
	})}`
	const generation = isIphone ? iphoneGenerationKey(modelData.modelSlug) : null
	const siblingSlugs = generation
		? modelData.deviceType.models.filter((entry) => {
				return (
					entry !== modelData.modelSlug &&
					iphoneGenerationKey(entry) === generation
				)
			})
		: modelData.deviceType.models.filter(
				(entry) => entry !== modelData.modelSlug,
			)

	const related = relatedServiceSlugs.flatMap((serviceSlug) => {
		const entry = getServiceBySlug(serviceSlug)
		if (!entry || !entry.brands.includes(brand.slug)) return []
		const blocked = entry.excludedDeviceTypes?.[brand.slug] || []
		if (blocked.includes(modelData.deviceType.slug)) return []
		return [
			{
				href: `/servicos/${buildServiceProductSlug({
					serviceSlug,
					brandSlug: brand.slug,
					modelSlug: modelData.modelSlug,
				})}`,
				label: entry.name,
			},
		]
	})

	const familyLabel = generation ? iphoneFamilyLabel(generation) : null
	const isSmartphone = modelData.deviceType.displayName === 'Smartphone'

	return {
		slug,
		name,
		hubHref,
		hubLabel: isIphone
			? 'Troca de bateria iPhone'
			: isSmartphone
				? `Troca de bateria ${brand.displayName}`
				: `Troca de bateria ${modelData.deviceType.displayName}`,
		hubLinkLabel: isIphone
			? 'Também realizamos troca de bateria em outros modelos de iPhone.'
			: isSmartphone
				? `Também realizamos troca de bateria em outros modelos ${brand.displayName}.`
				: `Também realizamos troca de bateria em outros modelos de ${modelData.deviceType.displayName}.`,
		pageHref: `/servicos/${slug}`,
		seo: {
			title: `Troca de Bateria ${name} em BH | Conectize`,
			description: `Troca de bateria do ${name} em Belo Horizonte. Faça o diagnóstico do aparelho e solicite um orçamento para substituição da bateria na Conectize.`,
			h1: `Troca de Bateria do ${name} em Belo Horizonte`,
		},
		intro: `Trocamos a bateria do ${name} na Conectize, em Belo Horizonte. Se a carga acaba rápido, o aparelho desliga sozinho ou esquenta ao carregar, avaliamos o seu ${name} e passamos o orçamento pelo WhatsApp antes da troca.`,
		signs: signsFor(name, isApple),
		steps: stepsFor(name, isApple),
		faq: faqFor(name),
		siblingsHeading:
			siblingSlugs.length === 0
				? null
				: familyLabel
					? `Troca de bateria nos outros ${familyLabel}`
					: 'Troca de bateria em outros modelos',
		siblings: siblingSlugs.map((modelSlug) => ({
			href: `/servicos/${buildServiceProductSlug({
				serviceSlug: 'troca-de-bateria',
				brandSlug: brand.slug,
				modelSlug,
			})}`,
			label: `Troca de bateria ${batteryModelLabel(modelSlug)}`,
		})),
		related,
		whatsappMessage: `Olá! Gostaria de um orçamento para troca de bateria do ${name}.`,
	}
}

export function BatteryModelPage({
	landing,
}: {
	landing: BatteryModelLanding
}) {
	const whatsappHref = buildWhatsAppUrl(landing.whatsappMessage)
	const weekday = business.openingHours[0]
	const saturday = business.openingHours[1]
	const canonical = `${getSiteUrl()}${landing.pageHref}`
	const serviceJsonLd = getServiceJsonLd({
		name: landing.seo.h1,
		description: landing.seo.description,
		serviceType: 'Troca de Bateria',
		url: canonical,
	})

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getFaqPageJsonLd(landing.faq)),
				}}
			/>

			<div className="min-h-screen pt-32 pb-20">
				<div className="container mx-auto px-4">
					<Breadcrumbs
						items={[
							{ label: 'Home', href: '/' },
							{ label: 'Serviços', href: '/conserto-de-celular-belo-horizonte' },
							{ label: landing.hubLabel, href: landing.hubHref },
							{ label: landing.name, href: landing.pageHref },
						]}
					/>

					<div className="grid gap-8 lg:grid-cols-[1fr_380px]">
						<article className="min-w-0">
							<header className="mb-8">
								<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
									{landing.seo.h1}
								</h1>
								<p className="text-lg text-muted-foreground">{landing.intro}</p>
							</header>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de bateria do {landing.name}
								</h2>
								<p className="text-muted-foreground">
									O serviço é a substituição da bateria desse modelo, na loja da
									Santa Efigênia. Instalamos uma bateria compatível com o{' '}
									{landing.name} e testamos a carga em seguida.
								</p>
								<p className="mt-4 text-muted-foreground">
									<Link
										href={landing.hubHref}
										className="font-medium text-primary hover:underline"
									>
										{landing.hubLinkLabel}
									</Link>
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quando é necessário trocar a bateria do {landing.name}?
								</h2>
								<ul className="list-disc list-inside space-y-2 text-muted-foreground">
									{landing.signs.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto custa trocar a bateria do {landing.name}?
								</h2>
								<p className="text-muted-foreground">
									<a
										href={whatsappHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary hover:underline"
									>
										Clique aqui
									</a>{' '}
									e fale com a gente. Fazemos o orçamento da troca de bateria do
									seu {landing.name}.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Como funciona a troca da bateria?
								</h2>
								<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
									{landing.steps.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ol>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									A troca da bateria apaga os dados do {landing.name}?
								</h2>
								<p className="text-muted-foreground">
									Não exige formatação: a troca é de hardware. Faça backup antes
									de deixar o aparelho, porque qualquer manutenção pode ter
									imprevisto.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto tempo demora a troca da bateria?
								</h2>
								<p className="text-muted-foreground">
									Em geral, a troca fica pronta em até 24 horas úteis.
									Confirmamos o prazo no orçamento.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									A troca da bateria possui garantia?
								</h2>
								<p className="text-muted-foreground">
									Sim. A garantia é de 12 meses e cobre defeito de fabricação da
									peça e problema relacionado à instalação.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de bateria do {landing.name} em Belo Horizonte
								</h2>
								<p className="text-muted-foreground mb-4">
									O atendimento é na loja ou com coleta e entrega na cidade.
									Traga o {landing.name} ou chame no WhatsApp para combinar a
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
									Outros serviços para {landing.name}
								</h2>
								<ul className="flex flex-wrap gap-2">
									{landing.related.map((entry) => (
										<li key={entry.href}>
											<Link
												href={entry.href}
												className="inline-flex rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/40"
											>
												{entry.label}
											</Link>
										</li>
									))}
								</ul>
							</section>

							{landing.siblingsHeading ? (
								<section className="bg-card rounded-xl p-8 mb-12 border border-border">
									<h2 className="text-2xl font-bold text-foreground mb-4">
										{landing.siblingsHeading}
									</h2>
									<ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
										{landing.siblings.map((model) => (
											<li key={model.href}>
												<Link
													href={model.href}
													className="block rounded-xl border border-border bg-secondary/30 p-4 hover:bg-secondary/40"
												>
													<span className="font-semibold text-foreground">
														{model.label}
													</span>
												</Link>
											</li>
										))}
									</ul>
								</section>
							) : null}

							<section className="bg-card rounded-xl p-8 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Perguntas frequentes
								</h2>
								<div className="space-y-6">
									{landing.faq.map((item) => (
										<div key={item.q}>
											<h3 className="text-lg font-semibold text-foreground mb-2">
												{item.q}
											</h3>
											<p className="text-muted-foreground">{item.a}</p>
										</div>
									))}
								</div>
							</section>
						</article>

						<aside className="h-fit lg:sticky lg:top-28 space-y-6">
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
										Informe que o aparelho é um {landing.name}. Respondemos com
										o valor da troca de bateria antes de seguir.
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
					</div>
				</div>
			</div>
		</>
	)
}
