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
	ASSISTENCIA_IPHONE_PATH,
	CONSERTO_IPHONE_PATH,
	IPHONE_GLASS_HUB_PATH,
	IPHONE_REAR_GLASS_HUB_PATH,
	IPHONE_SCREEN_HUB_PATH,
	IPHONE_SCREEN_HUB_SLUG,
	listIphoneSeoModels,
	servicesHubBreadcrumb,
} from '@/lib/marketing/iphone-pillars'
import { getSiteUrl } from '@/lib/utils/site-url'

export { IPHONE_SCREEN_HUB_SLUG }

export const iphoneScreenHubSeo = {
	title: 'Troca de Tela de iPhone em BH | Conectize',
	description:
		'Troca de tela de iPhone em Belo Horizonte: LCD e OLED, orçamento pelo WhatsApp. Atendemos XR ao 17 Pro Max. Loja na Santa Efigênia.',
	h1: 'Troca de tela do iPhone em Belo Horizonte',
} as const

const whatsappMessage =
	'Olá! Vim pelo site e quero orçamento de troca de tela do iPhone.'

const faq = [
	{
		q: 'Só o vidro ou a tela toda?',
		a: 'Só o vidro quando o display ainda funciona bem. Se há manchas, linhas ou toque morto, é tela completa.',
	},
	{
		q: 'iPhone 11 e XR são LCD ou OLED?',
		a: 'XR e iPhone 11 “padrão” usam LCD. 11 Pro/Pro Max e do 12 em diante são OLED.',
	},
	{
		q: 'Quanto custa?',
		a: 'Depende do modelo e da opção de peça. Peça o orçamento no WhatsApp com o modelo do seu iPhone.',
	},
	{
		q: 'Quanto tempo demora?',
		a: 'Confirmamos o prazo no orçamento, conforme estoque e agenda.',
	},
	{
		q: 'A Conectize é assistência autorizada Apple?',
		a: 'Não. Somos assistência técnica independente, especializada em iPhone. Explicamos peça e preço antes do serviço.',
	},
	{
		q: 'Fazem troca de tela do 12, 13 e XR?',
		a: 'Sim. Atendemos XR e a linha 11 ao 17. Escolha o modelo na grade ou envie no WhatsApp.',
	},
	{
		q: 'A biometria continua funcionando?',
		a: 'Depende do modelo e da peça. Explicamos no orçamento o que esperar do Face ID / Touch ID.',
	},
	{
		q: 'Onde trocar a tela em BH?',
		a: `Na Conectize, ${business.address.streetAddress}, Santa Efigênia. WhatsApp ${business.phoneDisplay}.`,
	},
]

const lcdOledRows = [
	{ modelo: 'iPhone XR e 11', tipo: 'LCD' },
	{ modelo: 'iPhone 11 Pro / Pro Max', tipo: 'OLED' },
	{ modelo: 'iPhone 12 em diante', tipo: 'OLED' },
]

const models = listIphoneSeoModels('troca-de-tela')
const pageHref = IPHONE_SCREEN_HUB_PATH
const canonical = `${getSiteUrl()}${pageHref}`

const breadcrumbs = [
	{ label: 'Início', href: '/' },
	servicesHubBreadcrumb(),
	{ label: 'Troca de tela iPhone', href: pageHref },
]

export function IphoneScreenHubPage () {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getServiceJsonLd({
						name: iphoneScreenHubSeo.h1,
						description: iphoneScreenHubSeo.description,
						serviceType: 'Troca de tela de iPhone',
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
									{iphoneScreenHubSeo.h1}
								</h1>
								<p className="text-lg text-muted-foreground leading-relaxed">
									Display trincado, manchado ou com toque falhando? Trocamos a
									tela do iPhone com orçamento claro pelo WhatsApp. Assistência
									técnica em Santa Efigênia, do iPhone X ao 17 Pro Max.
								</p>
								<p className="mt-4 text-muted-foreground">
									<Link href={ASSISTENCIA_IPHONE_PATH} className="text-primary font-medium hover:underline">
										Assistência iPhone
									</Link>
									{' · '}
									<Link href={CONSERTO_IPHONE_PATH} className="text-primary font-medium hover:underline">
										Conserto de iPhone
									</Link>
									{' · '}
									<Link href={IPHONE_REAR_GLASS_HUB_PATH} className="text-primary font-medium hover:underline">
										Vidro traseiro do iPhone
									</Link>
								</p>
							</header>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quando trocar a tela do iPhone
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Vidro estilhaçado, manchas pretas, linhas, brilho irregular ou
									toque que “pula”. Se ainda liga, faça um backup antes de trazer.
									{/* TODO: foto real de display antes/depois */}
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Só o vidro ou a tela completa?
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Imagem boa e só o cristal trincado? Veja a{' '}
									<Link href={IPHONE_GLASS_HUB_PATH} className="text-primary font-medium hover:underline">
										troca de vidro da tela
									</Link>
									. Painel com mancha, sem imagem ou touch morto? É tela
									completa: dizemos qual opção cabe no seu caso no orçamento.
								</p>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Tipos de tela: LCD e OLED por modelo
								</h2>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-sm border-collapse">
										<thead>
											<tr className="border-b border-border">
												<th className="py-3 pr-4 font-semibold text-foreground">Linha</th>
												<th className="py-3 font-semibold text-foreground">Painel</th>
											</tr>
										</thead>
										<tbody className="text-muted-foreground">
											{lcdOledRows.map((row) => (
												<tr key={row.modelo} className="border-b border-border/60">
													<td className="py-3 pr-4">{row.modelo}</td>
													<td className="py-3">{row.tipo}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Opções de peça e preço
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Quando há mais de uma faixa de display, explicamos as
									diferenças e você escolhe. Valor: consulte no WhatsApp com o
									modelo.
								</p>
								{/* TODO_PRECO_A_PARTIR_DE por modelo */}
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Tempo de troca
								</h2>
								<p className="text-muted-foreground leading-relaxed">
									Com peça disponível, muitos casos saem no mesmo dia útil.
									Confirmamos o prazo no orçamento. Coleta em BH: use o
									calculador ao lado.
								</p>
								{/* TODO_PRAZO */}
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
									Modelo + foto da tela. Respondemos com as opções e o prazo.
								</p>
								<a
									href={buildWhatsAppUrl(whatsappMessage)}
									target="_blank"
									rel="noopener noreferrer"
									data-placement="cta-final"
									className="inline-flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
								>
									<MessageCircle className="w-5 h-5" />
									WhatsApp: troca de tela
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
										Diga o modelo do iPhone no WhatsApp.
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
