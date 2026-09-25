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

export const POCO_X6_PRO_GLASS_SLUG =
	'troca-de-vidro-da-tela-xiaomi-poco-x6-pro'

const pageHref = `/servicos/${POCO_X6_PRO_GLASS_SLUG}`
const hubHref = '/servicos/troca-de-vidro-da-tela-xiaomi-smartphone'

const screenSigns = [
	'A tela fica sem imagem, mesmo com o aparelho ligado.',
	'Aparecem linhas ou manchas no display.',
	'O toque falha ou dispara sozinho.',
	'O vidro quebrou e a imagem ou o toque também foram afetados.',
]

const glassSigns = [
	'O vidro trincou e a imagem continua normal.',
	'O toque responde em toda a tela.',
	'Não há manchas, linhas nem áreas apagadas no display.',
]

const comparison = [
	{
		situation: 'Vidro quebrado, com imagem e toque normais',
		repair: 'Avaliação para troca do vidro',
	},
	{
		situation: 'Apenas o vidro trincado',
		repair: 'Avaliação para troca do vidro',
	},
	{
		situation: 'Sem imagem',
		repair: 'Avaliação do conjunto de tela',
	},
	{
		situation: 'Toque com falhas',
		repair: 'Avaliação do conjunto de tela',
	},
	{
		situation: 'Manchas ou linhas no display',
		repair: 'Avaliação do conjunto de tela',
	},
]

const steps = [
	'Avaliamos a imagem, o toque e o estado do vidro.',
	'Passamos o orçamento no WhatsApp antes de seguir.',
	'Se o display e o toque estão íntegros, avaliamos a troca só do vidro.',
	'Se há manchas, linhas, tela sem imagem ou falha de toque, indicamos a troca do conjunto.',
	'Depois do reparo, testamos imagem e toque.',
]

const relatedServiceSlugs = [
	'troca-de-bateria',
	'troca-de-camera',
	'reparo-de-placa',
	'reparo-de-audio',
	'troca-de-conector',
	'troca-de-vidro-tampa-traseira',
] as const

export const pocoX6ProScreenSeo = {
	title: 'Troca de Tela POCO X6 Pro em BH | Conectize',
	description:
		'Troca de tela e vidro do POCO X6 Pro em Belo Horizonte. Avalie o aparelho e descubra qual reparo é necessário. Solicite um orçamento.',
	h1: 'Troca de Tela e Vidro do POCO X6 Pro em Belo Horizonte',
}

export const pocoX6ProScreenFaq = [
	{
		q: 'Quando preciso trocar a tela do POCO X6 Pro?',
		a: 'Quando a tela fica sem imagem, surgem manchas ou linhas, ou o toque falha. Nesses casos avaliamos a troca do conjunto, não só do vidro.',
	},
	{
		q: 'É possível trocar somente o vidro do POCO X6 Pro?',
		a: 'Sim, quando o diagnóstico confirma que a imagem e o toque estão normais e só o vidro externo quebrou. Se o display foi afetado, a troca do vidro não resolve.',
	},
	{
		q: 'Qual a diferença entre trocar o vidro e trocar a tela?',
		a: 'O vidro é a camada externa. A tela é o conjunto, com display e toque. Vidro trincado com imagem e toque bons pode ser só vidro. Sem imagem, com manchas, linhas ou falha de toque, avaliamos o conjunto.',
	},
	{
		q: 'Quanto custa trocar a tela do POCO X6 Pro?',
		a: 'Clique em Solicitar orçamento e fale com a gente no WhatsApp. Fazemos o orçamento da troca de tela do seu POCO X6 Pro.',
	},
	{
		q: 'Quanto custa trocar o vidro do POCO X6 Pro?',
		a: 'Clique em Solicitar orçamento e fale com a gente no WhatsApp. Fazemos o orçamento da troca de vidro do seu POCO X6 Pro.',
	},
	{
		q: 'Quanto tempo demora o reparo?',
		a: 'Em geral, o reparo fica pronto em até 24 horas úteis. Casos mais complexos podem levar até 48 horas. O prazo é confirmado no orçamento.',
	},
	{
		q: 'O serviço possui garantia?',
		a: 'Sim. A garantia é de 6 meses e cobre defeito de fabricação da peça e problema relacionado à instalação.',
	},
	{
		q: 'O reparo preserva os dados do aparelho?',
		a: 'A troca é de hardware e não exige formatação. Faça backup antes de deixar o aparelho, porque qualquer manutenção pode ter imprevisto.',
	},
	{
		q: 'Onde trocar a tela do POCO X6 Pro em Belo Horizonte?',
		a: 'Na Conectize, R. Padre Rolim, 620, Santa Efigênia. Também há coleta e entrega em Belo Horizonte.',
	},
]

function relatedServices() {
	return relatedServiceSlugs.flatMap((serviceSlug) => {
		const service = getServiceBySlug(serviceSlug)
		if (!service) return []
		return [
			{
				href: `/servicos/${buildServiceProductSlug({
					serviceSlug,
					brandSlug: 'xiaomi',
					modelSlug: 'poco-x6-pro',
				})}`,
				label: service.name,
			},
		]
	})
}

export function PocoX6ProScreenPage() {
	const whatsappHref = buildWhatsAppUrl(
		'Olá! Gostaria de um orçamento para troca de tela ou vidro do POCO X6 Pro.',
	)
	const screenQuoteHref = buildWhatsAppUrl(
		'Olá! Gostaria de um orçamento para troca de tela do POCO X6 Pro.',
	)
	const glassQuoteHref = buildWhatsAppUrl(
		'Olá! Gostaria de um orçamento para troca de vidro do POCO X6 Pro.',
	)
	const related = relatedServices()
	const weekday = business.openingHours[0]
	const saturday = business.openingHours[1]
	const canonical = `${getSiteUrl()}${pageHref}`
	const serviceJsonLd = getServiceJsonLd({
		name: pocoX6ProScreenSeo.h1,
		description: pocoX6ProScreenSeo.description,
		serviceType: 'Troca de tela e vidro',
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
					__html: JSON.stringify(getFaqPageJsonLd(pocoX6ProScreenFaq)),
				}}
			/>

			<div className="min-h-screen pt-32 pb-20">
				<div className="container mx-auto px-4">
					<Breadcrumbs
						items={[
							{ label: 'Home', href: '/' },
							{ label: 'Serviços', href: '/conserto-de-celular-belo-horizonte' },
							{ label: 'Troca de vidro Xiaomi', href: hubHref },
							{ label: 'Troca de tela e vidro', href: pageHref },
						]}
					/>

					<div className="grid gap-8 lg:grid-cols-[1fr_380px]">
						<article className="min-w-0">
							<header className="mb-8">
								<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
									{pocoX6ProScreenSeo.h1}
								</h1>
								<p className="text-lg text-muted-foreground">
									Se a tela do POCO X6 Pro quebrou, trincou ou apresenta falha
									de imagem ou de toque, avaliamos o aparelho na Conectize, em
									Belo Horizonte. O diagnóstico indica se cabe a troca só do
									vidro ou a substituição do conjunto. O orçamento sai no
									WhatsApp antes do reparo.
								</p>
							</header>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de tela do POCO X6 Pro
								</h2>
								<p className="text-muted-foreground">
									A troca de tela substitui o conjunto, com display e toque. Ela
									entra em avaliação quando o vidro sozinho não explica o
									defeito.
								</p>
								<ul className="mt-4 list-disc list-inside space-y-2 text-muted-foreground">
									{screenSigns.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de vidro do POCO X6 Pro
								</h2>
								<p className="text-muted-foreground">
									A troca de vidro da tela é outro serviço. Ela só é avaliada
									quando a imagem e o toque estão normais e o dano ficou no
									vidro externo. Se o display foi afetado, trocar só o vidro não
									resolve.
								</p>
								<ul className="mt-4 list-disc list-inside space-y-2 text-muted-foreground">
									{glassSigns.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Qual a diferença entre trocar o vidro e trocar a tela do POCO
									X6 Pro?
								</h2>
								<p className="text-muted-foreground mb-4">
									O vidro é a camada externa. A tela é o conjunto, que inclui o
									display e o toque. A tabela orienta a conversa. O reparo só é
									definido depois de ver o aparelho.
								</p>
								<div className="overflow-x-auto">
									<table className="w-full text-left text-sm">
										<caption className="sr-only">
											Situação da tela e reparo que avaliamos
										</caption>
										<thead>
											<tr className="border-b border-border">
												<th
													scope="col"
													className="py-3 pr-4 font-semibold text-foreground"
												>
													Situação
												</th>
												<th
													scope="col"
													className="py-3 font-semibold text-foreground"
												>
													Reparo indicado
												</th>
											</tr>
										</thead>
										<tbody>
											{comparison.map((row) => (
												<tr
													key={row.situation}
													className="border-b border-border"
												>
													<td className="py-3 pr-4 text-muted-foreground">
														{row.situation}
													</td>
													<td className="py-3 text-muted-foreground">
														{row.repair}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto custa trocar a tela do POCO X6 Pro?
								</h2>
								<p className="text-muted-foreground">
									<a
										href={screenQuoteHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary hover:underline"
									>
										Clique aqui
									</a>{' '}
									e fale com a gente. Fazemos o orçamento da troca de tela do
									seu POCO X6 Pro.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto custa trocar o vidro do POCO X6 Pro?
								</h2>
								<p className="text-muted-foreground">
									<a
										href={glassQuoteHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary hover:underline"
									>
										Clique aqui
									</a>{' '}
									e fale com a gente. Fazemos o orçamento da troca de vidro do
									seu POCO X6 Pro.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Como funciona o serviço?
								</h2>
								<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
									{steps.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ol>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Quanto tempo demora?
								</h2>
								<p className="text-muted-foreground">
									Em geral, o reparo fica pronto em até 24 horas úteis. Casos
									mais complexos podem levar até 48 horas. Confirmamos o prazo
									no orçamento.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									O serviço possui garantia?
								</h2>
								<p className="text-muted-foreground">
									Sim. A garantia é de 6 meses e cobre defeito de fabricação da
									peça e problema relacionado à instalação.
								</p>
							</section>

							<section className="bg-card rounded-xl p-8 mb-12 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Troca de tela POCO X6 Pro em Belo Horizonte
								</h2>
								<p className="text-muted-foreground mb-4">
									O atendimento é na loja ou com coleta e entrega na cidade.
									Traga o aparelho ou chame no WhatsApp para combinar a
									retirada.
								</p>
								<p className="mb-4 text-muted-foreground">
									<Link
										href={hubHref}
										className="font-medium text-primary hover:underline"
									>
										Também avaliamos troca de vidro da tela em outros aparelhos
										Xiaomi.
									</Link>
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
									Outros serviços para POCO X6 Pro
								</h2>
								<ul className="flex flex-wrap gap-2">
									{related.map((entry) => (
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

							<section className="bg-card rounded-xl p-8 border border-border">
								<h2 className="text-2xl font-bold text-foreground mb-4">
									Perguntas frequentes
								</h2>
								<div className="space-y-6">
									{pocoX6ProScreenFaq.map((item) => (
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
										Informe se a imagem e o toque do POCO X6 Pro continuam
										normais. Respondemos com o orçamento do reparo indicado.
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
