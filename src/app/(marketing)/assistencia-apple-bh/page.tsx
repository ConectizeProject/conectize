import { MapPin, MessageCircle, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { Button } from '@/components/ui/button'
import {
	buildWhatsAppUrl,
	business,
	getFaqPageJsonLd,
	getServiceJsonLd,
} from '@/lib/data/business'
import {
	ASSISTENCIA_IPHONE_PATH,
	CONSERTO_IPHONE_PATH,
	IPHONE_BATTERY_HUB_PATH,
	IPHONE_GLASS_HUB_PATH,
	IPHONE_REAR_GLASS_HUB_PATH,
	IPHONE_SCREEN_HUB_PATH,
	iphoneServiceHubHref,
	listIphoneSeoModels,
	servicesHubBreadcrumb,
} from '@/lib/marketing/iphone-pillars'
import { getSiteUrl } from '@/lib/utils/site-url'

const pageHref = ASSISTENCIA_IPHONE_PATH
const canonical = `${getSiteUrl()}${pageHref}`

const title = 'Assistência Técnica iPhone em BH | Conectize'
const description =
	'Assistência técnica independente para iPhone em Belo Horizonte: tela, bateria, vidro traseiro e mais. Orçamento pelo WhatsApp. Loja em Santa Efigênia.'
const h1 = 'Assistência técnica de iPhone em Belo Horizonte'

const whatsappMessage =
	'Olá! Vim pelo site e quero orçamento de assistência técnica para iPhone.'

const faq = [
	{
		q: 'A Conectize é assistência autorizada Apple?',
		a: 'Não. Somos uma assistência técnica independente, especializada em iPhone. Explicamos antes do serviço quais peças usamos e as opções de preço.',
	},
	{
		q: 'Quais reparos de iPhone vocês fazem?',
		a: 'Tela, vidro da tela, vidro traseiro, bateria, conector de carga, câmera, placa, software e avaliação após contato com líquido.',
	},
	{
		q: 'Atendem perto de mim em BH?',
		a: `Sim. Loja na ${business.address.neighborhood}, ${business.address.streetAddress}. Também fazemos coleta e entrega em Belo Horizonte.`,
	},
	{
		q: 'Como peço orçamento?',
		a: 'Pelo WhatsApp: diga o modelo e o problema. Passamos o valor antes de qualquer serviço.',
	},
	{
		q: 'Vocês usam peça original?',
		a: 'Informamos com transparência cada opção disponível. Você escolhe com base em preço, prazo e o que espera do aparelho.',
	},
	{
		q: 'Quanto tempo demora?',
		a: 'Depende do serviço e da peça. Confirmamos o prazo no orçamento.',
	},
	{
		q: 'Tem garantia?',
		a: 'Sim. A cobertura acompanha o tipo de reparo e é informada antes de você autorizar.',
		// TODO: detalhar meses por serviço (ex.: bateria 12 meses)
	},
	{
		q: 'Qual a diferença entre autorizada e independente?',
		a: 'A rede autorizada segue o processo oficial da marca. Na assistência independente há mais opções de peça e preço, com clareza sobre o que será instalado. Esse é o nosso modelo.',
	},
]

const serviceCards = [
	{ label: 'Troca de tela', href: IPHONE_SCREEN_HUB_PATH, blurb: 'Display quebrado, manchas ou toque falhando.' },
	{ label: 'Troca de bateria', href: IPHONE_BATTERY_HUB_PATH, blurb: 'Autonomia curta ou desligamentos.' },
	{ label: 'Vidro traseiro', href: IPHONE_REAR_GLASS_HUB_PATH, blurb: 'Tampa trincada ou estilhaçada.' },
	{ label: 'Vidro da tela', href: IPHONE_GLASS_HUB_PATH, blurb: 'Só o vidro, com o display ainda ok.' },
	{ label: 'Conector de carga', href: iphoneServiceHubHref('troca-de-conector'), blurb: 'Não carrega ou carga intermitente.' },
	{ label: 'Câmera', href: iphoneServiceHubHref('troca-de-camera'), blurb: 'Foco travado, imagem preta ou erro no app.' },
	{ label: 'Reparo de placa', href: iphoneServiceHubHref('reparo-de-placa'), blurb: 'Não liga ou reinicia após queda/água.' },
	{ label: 'Software', href: iphoneServiceHubHref('correcoes-de-software'), blurb: 'Travamentos e falhas de sistema.' },
]

const models = listIphoneSeoModels('troca-de-tela')

export const metadata: Metadata = {
	title,
	description,
	alternates: { canonical },
	openGraph: {
		title,
		description,
		url: canonical,
		siteName: business.name,
		locale: 'pt_BR',
		type: 'website',
	},
	robots: { index: true, follow: true },
}

const breadcrumbs = [
	{ label: 'Início', href: '/' },
	servicesHubBreadcrumb(),
	{ label: 'Assistência técnica iPhone', href: pageHref },
]

export default function AssistenciaAppleBhPage () {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getServiceJsonLd({
						name: h1,
						description,
						serviceType: 'Assistência técnica de iPhone',
						url: canonical,
					})),
				}}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(getFaqPageJsonLd(faq)) }}
			/>

			<main className="min-h-screen pt-32 pb-20 bg-background">
				<div className="container mx-auto px-4">
					<Breadcrumbs items={breadcrumbs} />

					<div className="grid gap-8 lg:grid-cols-[1fr_360px]">
						<article className="min-w-0 space-y-10">
							<header className="max-w-3xl">
								<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
									{h1}
								</h1>
								<p className="text-lg text-muted-foreground leading-relaxed">
									Assistência técnica independente de iPhone em Belo Horizonte,
									na Santa Efigênia. Orçamento pelo WhatsApp, peça e prazo
									claros antes de autorizar, do XR ao iPhone 17.
								</p>
								<p className="mt-4 text-muted-foreground">
									Problema específico? Veja também{' '}
									<Link href={CONSERTO_IPHONE_PATH} className="text-primary font-medium hover:underline">
										conserto de iPhone
									</Link>
									,{' '}
									<Link href={IPHONE_SCREEN_HUB_PATH} className="text-primary font-medium hover:underline">
										troca de tela
									</Link>
									{' '}ou{' '}
									<Link href={IPHONE_BATTERY_HUB_PATH} className="text-primary font-medium hover:underline">
										troca de bateria
									</Link>
									.
								</p>
							</header>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Assistência técnica para iPhone em BH
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									A Conectize fica na R. Padre Rolim, 620: assistência de
									celular e Apple. Atendemos
									quem precisa de manutenção de iPhone com comunicação clara e direta:
									modelo, sintoma, opções de peça e valor.
								</p>
								<p className="text-muted-foreground leading-relaxed">
									Segunda a sexta 8h30–18h30, sábado 10h–14h. Prefere não vir?
									Há coleta e entrega em BH.
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Serviços para iPhone
								</h2>
								<ul className="grid sm:grid-cols-2 gap-4">
									{serviceCards.map((card) => (
										<li key={card.href}>
											<Link
												href={card.href}
												className="block h-full rounded-xl border border-border bg-secondary/30 p-5 hover:bg-secondary/40 transition-colors"
											>
												<h3 className="text-lg font-bold text-foreground mb-2">
													{card.label}
												</h3>
												<p className="text-sm text-muted-foreground mb-3">
													{card.blurb}
												</p>
												<span className="text-primary text-sm font-medium">
													Ver serviço →
												</span>
											</Link>
										</li>
									))}
								</ul>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Modelos atendidos
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-6">
									iPhone 11 ao 17 (Pro, Pro Max, Plus) e XR. Modelo antigo ou
									raro? Consulte no WhatsApp.
								</p>
								<ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
									{models.map((model) => (
										<li key={model.slug}>
											<Link
												href={model.href}
												className="block rounded-lg border border-border bg-secondary/20 px-4 py-3 text-sm font-medium text-foreground hover:text-primary transition-colors"
											>
												{model.label}
											</Link>
										</li>
									))}
								</ul>
								{/* TODO: foto real da bancada / vitrine */}
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Como funciona
								</h2>
								<ol className="space-y-3 text-muted-foreground list-decimal list-inside leading-relaxed">
									<li>
										<strong className="text-foreground">WhatsApp:</strong> modelo e problema (foto ajuda).
									</li>
									<li>
										<strong className="text-foreground">Diagnóstico:</strong> na loja ou após a coleta.
									</li>
									<li>
										<strong className="text-foreground">Aprovação:</strong> valor, peça e prazo antes de abrir.
									</li>
									<li>
										<strong className="text-foreground">Serviço e testes:</strong> toque, carga, câmera etc.
									</li>
									<li>
										<strong className="text-foreground">Retirada ou entrega:</strong> Santa Efigênia ou coleta em BH.
									</li>
								</ol>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Peças e garantia
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									Quando houver mais de uma faixa de peça, explicamos as
									diferenças e você escolhe. Preço e prazo saem no orçamento:
									peça pelo WhatsApp.
								</p>
								<p className="text-muted-foreground leading-relaxed">
									Garantia cobre defeito de fabricação da peça e problemas da
									instalação, no prazo do serviço contratado.
								</p>
								{/* TODO: listar meses de garantia por tipo de reparo */}
								{/* TODO_PRECO_A_PARTIR_DE por serviço */}
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Autorizada Apple ou assistência independente?
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									Não somos assistência autorizada Apple. A rede oficial segue
									o processo da marca; nós somos especializados em iPhone, com
									mais flexibilidade de peça e preço, sempre transparentes
									sobre o que entra no aparelho.
								</p>
								<p className="text-muted-foreground leading-relaxed">
									Se o iPhone ainda está na garantia de fábrica e o caso pede
									canal oficial, orientamos você a procurar a Apple.
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-6">
									Perguntas frequentes
								</h2>
								<div className="space-y-6">
									{faq.map((item) => (
										<div key={item.q}>
											<h3 className="text-lg font-semibold text-foreground mb-2">
												{item.q}
											</h3>
											<p className="text-muted-foreground leading-relaxed">
												{item.a}
											</p>
										</div>
									))}
								</div>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Onde estamos
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									<strong className="text-foreground">{business.name}</strong>
									<br />
									{business.address.full}
									<br />
									WhatsApp: {business.phoneDisplay}
								</p>
								<ul className="text-muted-foreground space-y-1 mb-6">
									{business.openingHours.map((item) => (
										<li key={item.label}>
											{item.label}: {item.display}
										</li>
									))}
								</ul>
								{/* TODO: incorporar mapa ou foto da fachada */}
								<div className="flex flex-col sm:flex-row gap-3">
									<Button variant="hero" size="xl" asChild>
										<a
											href={buildWhatsAppUrl(whatsappMessage)}
											target="_blank"
											rel="noopener noreferrer"
											data-placement="cta-final"
										>
											<MessageCircle className="w-5 h-5" />
											Pedir orçamento no WhatsApp
										</a>
									</Button>
									<Button variant="outline" size="xl" asChild>
										<a href={`tel:${business.phone}`}>
											<Phone className="w-5 h-5" />
											Ligar agora
										</a>
									</Button>
								</div>
							</section>
						</article>

						<aside className="h-fit lg:sticky lg:top-28 space-y-6">
							<div className="rounded-xl border border-border bg-card p-6">
								<h2 className="text-xl font-bold text-foreground mb-3">
									Orçamento rápido
								</h2>
								<p className="text-sm text-muted-foreground mb-4">
									Envie o modelo e o sintoma. Respondemos com o próximo passo.
								</p>
								<a
									href={buildWhatsAppUrl(whatsappMessage)}
									target="_blank"
									rel="noopener noreferrer"
									data-placement="aside"
									className="flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
								>
									<MessageCircle className="w-5 h-5" />
									WhatsApp
								</a>
								<a
									href={`tel:${business.phone}`}
									className="mt-3 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
								>
									<Phone className="w-5 h-5" />
									Ligar
								</a>
							</div>
							<div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
								<p className="flex items-start gap-2">
									<MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
									{business.address.full}
								</p>
								<p>
									<Link href={CONSERTO_IPHONE_PATH} className="text-primary hover:underline">
										Conserto de iPhone
									</Link>
									{' · '}
									<Link href={IPHONE_SCREEN_HUB_PATH} className="text-primary hover:underline">
										Tela
									</Link>
									{' · '}
									<Link href={IPHONE_REAR_GLASS_HUB_PATH} className="text-primary hover:underline">
										Vidro traseiro
									</Link>
								</p>
							</div>
						</aside>
					</div>
				</div>
			</main>
		</>
	)
}
