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
import { getServiceBySlug } from '@/lib/data/services'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'
import { getSiteUrl } from '@/lib/utils/site-url'

export const IPHONE_13_BATTERY_SLUG = 'troca-de-bateria-apple-iphone-13'

const hubHref = '/servicos/troca-de-bateria-apple-iphone'
const pageHref = `/servicos/${IPHONE_13_BATTERY_SLUG}`

const relatedServiceSlugs = [
	'troca-de-tela',
	'troca-de-vidro-da-tela',
	'troca-de-camera',
	'reparo-de-placa',
	'troca-de-conector',
	'reparo-de-audio',
] as const

const siblingModels = [
	{ slug: 'iphone-13-pro', label: 'Troca de bateria iPhone 13 Pro' },
	{ slug: 'iphone-13-pro-max', label: 'Troca de bateria iPhone 13 Pro Max' },
	{ slug: 'iphone-13-mini', label: 'Troca de bateria iPhone 13 mini' },
] as const

const signs = [
	'A autonomia caiu rápido, mesmo com o iPhone 13 em repouso.',
	'O aparelho desliga com a porcentagem ainda alta.',
	'Esquenta ao carregar.',
	'A saúde da bateria aparece muito baixa e o consumo dispara.',
	'A carga trava e não passa de uma certa porcentagem.',
	'A bateria inchou e pressiona a tela ou a carcaça. Nesse caso, evite forçar o aparelho.',
]

export const iphone13BatteryFaq = [
	{
		q: 'Quando devo trocar a bateria do iPhone 13?',
		a: 'Quando a autonomia caiu muito, o aparelho desliga com porcentagem alta, esquenta na carga, a carga trava ou a bateria está inchada.',
	},
	{
		q: 'Quanto custa trocar a bateria do iPhone 13?',
		a: 'Clique em Solicitar orçamento e fale com a gente no WhatsApp. Fazemos o orçamento da troca de bateria do seu iPhone 13.',
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
		q: 'Onde trocar a bateria do iPhone 13 em Belo Horizonte?',
		a: 'Na Conectize, R. Padre Rolim, 620, Santa Efigênia. Também há coleta e entrega em Belo Horizonte.',
	},
]

export const iphone13BatterySeo = {
	title: 'Troca de Bateria iPhone 13 em BH | Conectize',
	description:
		'Troca de bateria do iPhone 13 em Belo Horizonte. Faça o diagnóstico do aparelho e solicite um orçamento para substituição da bateria na Conectize.',
	h1: 'Troca de Bateria do iPhone 13 em Belo Horizonte',
}

function serviceHref(serviceSlug: string, modelSlug = 'iphone-13') {
	return `/servicos/${buildServiceProductSlug({ serviceSlug, brandSlug: 'apple', modelSlug })}`
}

export function Iphone13BatteryPage() {
	const whatsappHref = buildWhatsAppUrl(
		'Olá! Gostaria de um orçamento para troca de bateria do iPhone 13.',
	)
	const relatedServices = relatedServiceSlugs.flatMap((serviceSlug) => {
		const service = getServiceBySlug(serviceSlug)
		if (!service) return []
		return [{ href: serviceHref(serviceSlug), label: service.name }]
	})
	const weekday = business.openingHours[0]
	const saturday = business.openingHours[1]
	const canonical = `${getSiteUrl()}${pageHref}`

	const serviceJsonLd = getServiceJsonLd({
		name: iphone13BatterySeo.h1,
		description: iphone13BatterySeo.description,
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
					__html: JSON.stringify(getFaqPageJsonLd(iphone13BatteryFaq)),
				}}
			/>

			<div className="min-h-screen pt-32 pb-20">
				<div className="container mx-auto px-4">
					<Breadcrumbs
						items={[
							{ label: 'Home', href: '/' },
							{ label: 'Serviços', href: '/servicos' },
							{ label: 'Troca de bateria iPhone', href: hubHref },
							{ label: 'iPhone 13', href: pageHref },
						]}
					/>

					<div className="grid gap-8 lg:grid-cols-[1fr_380px]">
						<article className="min-w-0">
							<header className="mb-8">
								<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
									{iphone13BatterySeo.h1}
								</h1>
								<p className="text-lg text-muted-foreground">
									Trocamos a bateria do iPhone 13 na Conectize, em Belo
									Horizonte. Se a carga acaba rápido, o aparelho desliga sozinho
									ou esquenta ao carregar, avaliamos o seu iPhone 13 e passamos
									o orçamento pelo WhatsApp antes da troca.
								</p>
							</header>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de bateria do iPhone 13
								</h2>
								<p className="text-muted-foreground">
									O serviço é a substituição da bateria desse modelo, na loja da
									Santa Efigênia. Instalamos uma bateria compatível com o iPhone
									13 e testamos a carga em seguida.
								</p>
								<p className="mt-4 text-muted-foreground">
									<Link
										href={hubHref}
										className="font-medium text-primary hover:underline"
									>
										Também realizamos troca de bateria em outros modelos de
										iPhone.
									</Link>
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quando é necessário trocar a bateria do iPhone 13?
								</h2>
								<ul className="list-disc list-inside space-y-2 text-muted-foreground">
									{signs.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto custa trocar a bateria do iPhone 13?
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
									seu iPhone 13.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Como funciona a troca da bateria?
								</h2>
								<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
									<li>Avaliamos o consumo e o comportamento da carga.</li>
									<li>Removemos a bateria com as tiras adesivas.</li>
									<li>Instalamos a bateria compatível com o iPhone 13.</li>
									<li>Testamos carga, aquecimento e estabilidade.</li>
								</ol>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									A troca da bateria apaga os dados do iPhone 13?
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
									Troca de bateria do iPhone 13 em Belo Horizonte
								</h2>
								<p className="text-muted-foreground mb-4">
									O atendimento é na loja ou com coleta e entrega na cidade.
									Traga o iPhone 13 ou chame no WhatsApp para combinar a
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
									Outros serviços para iPhone 13
								</h2>
								<ul className="flex flex-wrap gap-2">
									{relatedServices.map((entry) => (
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

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de bateria nos outros iPhone 13
								</h2>
								<ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
									{siblingModels.map((model) => (
										<li key={model.slug}>
											<Link
												href={serviceHref('troca-de-bateria', model.slug)}
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

							<section className="bg-card rounded-xl p-8 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Perguntas frequentes
								</h2>
								<div className="space-y-6">
									{iphone13BatteryFaq.map((item) => (
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
										Informe que o aparelho é um iPhone 13. Respondemos com o
										valor da troca de bateria antes de seguir.
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
