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
	IPHONE_REAR_GLASS_HUB_PATH,
	IPHONE_SCREEN_HUB_PATH,
	iphoneServiceHubHref,
	servicesHubBreadcrumb,
} from '@/lib/marketing/iphone-pillars'
import { getSiteUrl } from '@/lib/utils/site-url'

const pageHref = CONSERTO_IPHONE_PATH
const canonical = `${getSiteUrl()}${pageHref}`

const title = 'Conserto de iPhone em BH | Conectize'
const description =
	'Conserto de iPhone em Belo Horizonte: tela, bateria, carga, câmera e mais. Diagnóstico e orçamento pelo WhatsApp. Loja na Santa Efigênia.'
const h1 = 'Conserto de iPhone em Belo Horizonte'

const whatsappMessage =
	'Olá! Vim pelo site e quero orçamento para conserto do meu iPhone.'

const problems = [
	{
		title: 'Tela quebrada ou com manchas',
		body: 'Trinca, linhas, manchas ou toque falhando. Em alguns casos dá para trocar só o vidro; se o painel falhou, é tela completa.',
		href: IPHONE_SCREEN_HUB_PATH,
		linkLabel: 'Troca de tela',
	},
	{
		title: 'Bateria viciada',
		body: 'Autonomia curta, desliga com % alta ou esquenta na carga. A troca devolve estabilidade sem apagar seus dados.',
		href: IPHONE_BATTERY_HUB_PATH,
		linkLabel: 'Troca de bateria',
	},
	{
		title: 'Vidro traseiro trincado',
		body: 'Tampa estilhaçada corta a mão e deixa entrar poeira. Trocamos o vidro/tampa e restauramos o acabamento.',
		href: IPHONE_REAR_GLASS_HUB_PATH,
		linkLabel: 'Vidro traseiro',
	},
	{
		title: 'iPhone não carrega',
		body: 'Cabo ok, mas a carga não sobe ou só funciona em um ângulo? Pode ser conector: o diagnóstico confirma.',
		href: iphoneServiceHubHref('troca-de-conector'),
		linkLabel: 'Conector de carga',
	},
	{
		title: 'Câmera com falha',
		body: 'Imagem preta, foco travado ou erro no app. Avaliamos o módulo e indicamos a troca quando necessário.',
		href: iphoneServiceHubHref('troca-de-camera'),
		linkLabel: 'Reparo de câmera',
	},
	{
		title: 'iPhone não liga',
		body: 'Sem reação, loop no logo ou reinício contínuo. Pode ser bateria, conector ou placa: avaliamos na loja.',
		href: iphoneServiceHubHref('reparo-de-placa'),
		linkLabel: 'Reparo de placa',
	},
	{
		title: 'Contato com água',
		body: 'Desligue, não carregue e traga o quanto antes. Quanto mais cedo a avaliação, maior a chance de limitar o dano.',
		href: iphoneServiceHubHref('reparo-de-agua'),
		linkLabel: 'Reparo por água',
	},
]

const prazoRows = [
	{ servico: 'Troca de tela', prazo: 'Consulte no WhatsApp' },
	{ servico: 'Troca de bateria', prazo: 'Consulte no WhatsApp' },
	{ servico: 'Vidro traseiro', prazo: 'Consulte no WhatsApp' },
	{ servico: 'Conector de carga', prazo: 'Consulte no WhatsApp' },
	{ servico: 'Câmera', prazo: 'Consulte no WhatsApp' },
	{ servico: 'Reparo de placa', prazo: 'Consulte no WhatsApp' },
	// TODO_PRAZO: substituir "Consulte no WhatsApp" pelos prazos reais
]

const precoRows = [
	'Troca de tela',
	'Troca de bateria',
	'Vidro traseiro',
	'Conector de carga',
	'Câmera',
	'Reparo de placa',
	// TODO_PRECO_A_PARTIR_DE: substituir "Em breve" pelos valores reais
] as const

const faq = [
	{
		q: 'Dá para consertar iPhone na hora?',
		a: 'Muitos serviços saem no mesmo dia quando há peça e agenda. Confirmamos o prazo no WhatsApp.',
	},
	{
		q: 'Vocês ficam perto de mim em BH?',
		a: `Sim. Santa Efigênia, ${business.address.streetAddress}. Também fazemos coleta e entrega.`,
	},
	{
		q: 'O diagnóstico tem custo?',
		a: 'Passamos o caminho do orçamento pelo WhatsApp. Em casos simples já indicamos a faixa; em placa ou líquido, avaliamos o aparelho.',
		// TODO: confirmar se diagnóstico é sem custo / política se não seguir com o reparo
	},
	{
		q: 'A Conectize é assistência autorizada Apple?',
		a: 'Não. Somos assistência técnica independente, especializada em iPhone. Explicamos peça e preço antes do serviço.',
	},
	{
		q: 'Consigo orçamento só pelo WhatsApp?',
		a: 'Sim. Informe modelo e problema. Em dúvidas, pedimos foto ou avaliação presencial.',
	},
	{
		q: 'O conserto apaga meus dados?',
		a: 'Trocas de tela, bateria, vidro e conector em geral não exigem formatação. Mesmo assim, faça backup.',
	},
	{
		q: 'Qual a diferença desta página para a de assistência técnica?',
		a: 'Aqui o foco é problema → solução. A página de assistência cobre o panorama da oficina e o posicionamento independente.',
	},
	{
		q: 'Atendem XR e modelos novos?',
		a: 'Sim: do XR e 11 até a série 17, incluindo Pro e Pro Max.',
	},
]

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
	{ label: 'Conserto de iPhone', href: pageHref },
]

export default function ConsertoIphoneBhPage () {
	const whatsappHref = buildWhatsAppUrl(whatsappMessage)

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getServiceJsonLd({
						name: h1,
						description,
						serviceType: 'Conserto de iPhone',
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
									Tela quebrada, bateria fraca, tampa trincada ou iPhone que não
									carrega? Na Conectize o caminho é direto: diga o problema,
									receba o orçamento e autorize o conserto. Loja independente
									na Santa Efigênia.
								</p>
								<p className="mt-4 text-muted-foreground">
									Visão geral da oficina:{' '}
									<Link href={ASSISTENCIA_IPHONE_PATH} className="text-primary font-medium hover:underline">
										assistência técnica iPhone em BH
									</Link>
									.
								</p>
							</header>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-6">
									Problemas mais comuns
								</h2>
								<div className="space-y-6">
									{problems.map((item) => (
										<div key={item.title}>
											<h3 className="text-lg font-semibold text-foreground mb-1">
												{item.title}
											</h3>
											<p className="text-muted-foreground leading-relaxed mb-2">
												{item.body}
											</p>
											<Link
												href={item.href}
												className="text-primary text-sm font-medium hover:underline"
											>
												{item.linkLabel} →
											</Link>
										</div>
									))}
								</div>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Tempo médio por tipo de conserto
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-6">
									O prazo depende do modelo, da peça e da agenda do dia.
									Confirmamos no orçamento.
								</p>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-sm border-collapse">
										<thead>
											<tr className="border-b border-border">
												<th className="py-3 pr-4 font-semibold text-foreground">Serviço</th>
												<th className="py-3 font-semibold text-foreground">Prazo</th>
											</tr>
										</thead>
										<tbody className="text-muted-foreground">
											{prazoRows.map((row) => (
												<tr key={row.servico} className="border-b border-border/60">
													<td className="py-3 pr-4">{row.servico}</td>
													<td className="py-3">{row.prazo}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Preços a partir de
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-6">
									O valor muda por geração do iPhone e opção de peça. Peça o
									orçamento atualizado pelo WhatsApp.
								</p>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-sm border-collapse">
										<thead>
											<tr className="border-b border-border">
												<th className="py-3 pr-4 font-semibold text-foreground">Serviço</th>
												<th className="py-3 font-semibold text-foreground">A partir de</th>
											</tr>
										</thead>
										<tbody className="text-muted-foreground">
											{precoRows.map((servico) => (
												<tr key={servico} className="border-b border-border/60">
													<td className="py-3 pr-4">{servico}</td>
													<td className="py-3">
														Em breve (
														<a
															href={whatsappHref}
															target="_blank"
															rel="noopener noreferrer"
															data-placement="tabela-precos"
															className="text-primary font-medium hover:underline"
														>
															Consulte no WhatsApp
														</a>
														)
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>

							<section className="rounded-xl border border-border bg-card p-8">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Diagnóstico e orçamento
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									Envie o modelo e o sintoma no WhatsApp. Em tela, bateria ou
									vidro trincado, muitas vezes já indicamos a faixa. Em “não
									liga” ou líquido, avaliamos o aparelho antes de fechar.
								</p>
								<p className="text-muted-foreground leading-relaxed">
									Hubs rápidos:{' '}
									<Link href={IPHONE_SCREEN_HUB_PATH} className="text-primary hover:underline">
										tela
									</Link>
									,{' '}
									<Link href={IPHONE_BATTERY_HUB_PATH} className="text-primary hover:underline">
										bateria
									</Link>
									{' '}e{' '}
									<Link href={IPHONE_REAR_GLASS_HUB_PATH} className="text-primary hover:underline">
										vidro traseiro
									</Link>
									.
								</p>
								{/* TODO: foto real de bancada de diagnóstico */}
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
									Localização e contato
								</h2>
								<p className="text-muted-foreground leading-relaxed mb-4">
									{business.address.full} · WhatsApp {business.phoneDisplay}
									<br />
									Seg–sex 8h30–18h30 · Sáb 10h–14h
								</p>
								<div className="flex flex-col sm:flex-row gap-3">
									<Button variant="hero" size="xl" asChild>
										<a
											href={whatsappHref}
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
									Fale sobre o problema
								</h2>
								<p className="text-sm text-muted-foreground mb-4">
									Modelo + sintoma. Indicamos o conserto e o próximo passo.
								</p>
								<a
									href={whatsappHref}
									target="_blank"
									rel="noopener noreferrer"
									data-placement="aside"
									className="flex items-center justify-center gap-2 bg-[hsl(142,70%,45%)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[hsl(142,70%,40%)] transition-colors"
								>
									<MessageCircle className="w-5 h-5" />
									WhatsApp
								</a>
							</div>
							<div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
								<p className="flex items-start gap-2">
									<MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
									{business.address.neighborhood}, BH
								</p>
							</div>
						</aside>
					</div>
				</div>
			</main>
		</>
	)
}
