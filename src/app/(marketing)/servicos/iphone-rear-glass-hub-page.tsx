import { MapPin, MessageCircle, Phone } from 'lucide-react'
import Link from 'next/link'
import { FreteCalculatorLazy } from '@/components/FreteCalculatorLazy'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	buildWhatsAppUrl,
	business,
	getFaqPageJsonLd,
	getLocalBusinessJsonLd,
	getServiceJsonLd,
} from '@/lib/data/business'
import {
	ASSISTENCIA_IPHONE_PATH,
	CONSERTO_IPHONE_PATH,
	IPHONE_REAR_GLASS_HUB_PATH,
	IPHONE_REAR_GLASS_HUB_SLUG,
	IPHONE_SCREEN_HUB_PATH,
	listIphoneSeoModels,
	servicesHubBreadcrumb,
} from '@/lib/marketing/iphone-pillars'
import { getSiteUrl } from '@/lib/utils/site-url'

export { IPHONE_REAR_GLASS_HUB_SLUG }

export const iphoneRearGlassHubSeo = {
	title: 'Troca de Vidro Traseiro iPhone em BH | Conectize',
	description:
		'Troca de vidro traseiro / tampa traseira de iPhone em Belo Horizonte. Orçamento pelo WhatsApp. Loja na Santa Efigênia.',
	h1: 'Troca de vidro traseiro do iPhone em Belo Horizonte',
} as const

const whatsappMessage =
	'Olá! Vim pelo site e quero orçamento de troca de vidro traseiro do iPhone.'

const faq = [
	{
		q: 'Vidro traseiro e tampa traseira são a mesma coisa?',
		a: 'Sim. No iPhone de vidro, as duas expressões descrevem o mesmo reparo.',
	},
	{
		q: 'Posso deixar o vidro trincado?',
		a: 'Dá para usar um tempo, mas lascas cortam a mão, entra poeira e o dano costuma piorar na próxima queda.',
	},
	{
		q: 'Quanto custa?',
		a: 'Depende do modelo e da cor. Peça o valor no WhatsApp com o modelo do seu iPhone.',
	},
	{
		q: 'Quanto tempo demora?',
		a: 'Confirmamos o prazo no orçamento, conforme peça e agenda.',
	},
	{
		q: 'Vocês têm todas as cores?',
		a: 'Envie a cor atual (ou a desejada) no WhatsApp. Confirmamos a disponibilidade.',
		// TODO: listar cores por modelo / estoque
	},
	{
		q: 'A Conectize é assistência autorizada Apple?',
		a: 'Não. Somos assistência técnica independente, especializada em iPhone. Explicamos peça e preço antes do serviço.',
	},
	{
		q: 'A carga por indução continua funcionando?',
		a: 'Após a troca, testamos o fechamento e, nos modelos compatíveis, a carga sem fio.',
	},
	{
		q: 'Onde trocar em BH?',
		a: `Na Conectize, ${business.address.streetAddress}, Santa Efigênia. WhatsApp ${business.phoneDisplay}.`,
	},
]

const models = listIphoneSeoModels('troca-de-vidro-tampa-traseira')
const pageHref = IPHONE_REAR_GLASS_HUB_PATH
const canonical = `${getSiteUrl()}${pageHref}`

const breadcrumbs = [
	{ label: 'Início', href: '/' },
	servicesHubBreadcrumb(),
	{ label: 'Vidro traseiro iPhone', href: pageHref },
]

export function IphoneRearGlassHubPage () {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(getLocalBusinessJsonLd()) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getServiceJsonLd({
						name: iphoneRearGlassHubSeo.h1,
						description: iphoneRearGlassHubSeo.description,
						serviceType: 'Troca de vidro traseiro de iPhone',
						url: canonical,
					})),
				}}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(getFaqPageJsonLd(faq)) }}
			/>

			<div className="min-h-screen pt-32 pb-20">
				<div className="container mx-auto px-4">
					<Breadcrumbs items={breadcrumbs} />

					<div className="grid gap-8 lg:grid-cols-[1fr_380px]">
						<article className="min-w-0 space-y-10">
							<header>
								<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
									{iphoneRearGlassHubSeo.h1}
								</h1>
								<p className="text-lg text-muted-foreground leading-relaxed">
									Tampa traseira trincada ou estilhaçada? Trocamos o vidro
									traseiro do iPhone com orçamento pelo WhatsApp. Assistência
									independente na Santa Efigênia.
								</p>
								<p className="mt-4 text-muted-foreground">
									<Link href={ASSISTENCIA_IPHONE_PATH} className="text-primary font-medium hover:underline">
										Assistência iPhone
									</Link>
									{' · '}
									<Link href={CONSERTO_IPHONE_PATH} className="text-primary font-medium hover:underline">
										Conserto
									</Link>
									{' · '}
									<Link href={IPHONE_SCREEN_HUB_PATH} className="text-primary font-medium hover:underline">
										Tela
									</Link>
								</p>
							</header>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Por que o vidro traseiro trinca e os riscos de deixar assim
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Uma queda de pouca altura já estilhaça o verso. Lascas cortam
									a mão, entra poeira e o visual (e o valor de revenda) caem.
									Adiar demais costuma sair mais caro depois, principalmente
									se a tela também sofreu.
									{/* TODO: foto real de tampa trincada / após troca */}
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Vidro traseiro × tampa traseira
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									É o mesmo serviço. “Vidro traseiro”, “tampa traseira” e “back
									glass” descrevem a troca do painel de trás do iPhone.
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Como é feita a troca
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Alinhamos modelo e cor, removemos o vidro danificado com
									cuidado nas câmeras e instalamos o novo painel. Depois
									testamos o fechamento. Prazo e preço: confirme no WhatsApp.
								</p>
								{/* TODO_PRAZO / TODO_PRECO_A_PARTIR_DE */}
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Cores disponíveis
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Cada geração tem uma paleta própria. Envie a cor (ou uma foto
									da traseira) no WhatsApp para confirmarmos o que temos.
								</p>
								{/* TODO: cores por modelo / disponibilidade */}
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Modelos atendidos
								</h2>
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

							<section className="rounded-xl border border-primary/20 bg-primary/5 p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Peça seu orçamento
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-6">
									Modelo + cor (e foto da traseira, se puder).
								</p>
								<a
									href={buildWhatsAppUrl(whatsappMessage)}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
								>
									<MessageCircle className="w-5 h-5" />
									WhatsApp: vidro traseiro
								</a>
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
										Modelo e cor no WhatsApp.
									</p>
									<a
										href={buildWhatsAppUrl(whatsappMessage)}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
									>
										<MessageCircle className="w-5 h-5" />
										WhatsApp
									</a>
									<a
										href={`tel:${business.phone}`}
										className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
									>
										<Phone className="w-5 h-5" />
										Ligar Agora
									</a>
									<p className="text-xs text-muted-foreground flex items-start gap-2">
										<MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
										{business.address.full}
									</p>
								</CardContent>
							</Card>
						</aside>
					</div>
				</div>
			</div>
		</>
	)
}
