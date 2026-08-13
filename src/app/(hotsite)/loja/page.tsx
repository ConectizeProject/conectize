import {
	Battery,
	Cable,
	Clock,
	Headphones,
	MapPin,
	Monitor,
	Shield,
	Smartphone,
	Store,
	Tablet,
} from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { business, getFormattedOpeningHours } from '@/lib/data/business'
import {
	getLojaFaqJsonLd,
	getLojaJsonLd,
	lojaCopy,
	lojaFaq,
	lojaHighlights,
	lojaLines,
	lojaPath,
	lojaProducts,
	lojaWhatsAppHref,
} from '@/lib/data/hotsite-loja'
import { getSiteUrl } from '@/lib/utils/site-url'
import { LojaShell } from './LojaShell'
import styles from './loja.module.css'
import { WhatsAppIcon } from './WhatsAppIcon'

const productIcons = [
	Monitor,
	Battery,
	Shield,
	Smartphone,
	Cable,
	Headphones,
] as const
const lineIcons = [Smartphone, Tablet, Store] as const

export const metadata: Metadata = {
	title: lojaCopy.title,
	description: lojaCopy.description,
	keywords: lojaCopy.keywords,
	robots: {
		index: true,
		follow: true,
	},
	alternates: {
		canonical: `${getSiteUrl()}${lojaPath}`,
	},
	openGraph: {
		type: 'website',
		title: lojaCopy.title,
		description: lojaCopy.description,
		url: `${getSiteUrl()}${lojaPath}`,
		siteName: lojaCopy.brand,
		locale: 'pt_BR',
	},
}

export default function LojaPage() {
	const hours = getFormattedOpeningHours()

	return (
		<LojaShell navBase="">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(getLojaJsonLd()) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(getLojaFaqJsonLd()) }}
			/>

			<main id="conteudo-principal">
				<section className={styles.hero} aria-labelledby="loja-titulo">
					<div className={styles.heroGlow} aria-hidden="true" />
					<div className={styles.wrap}>
						<p className={styles.eyebrow}>{lojaCopy.heroEyebrow}</p>
						<h1 id="loja-titulo" className={styles.display}>
							{lojaCopy.heroTitle}
						</h1>
						<p className={styles.lead}>{lojaCopy.heroLead}</p>
						<div className={styles.actions}>
							<Button
								variant="whatsapp"
								size="lg"
								className={styles.press}
								asChild
							>
								<a
									href={lojaWhatsAppHref}
									target="_blank"
									rel="noopener noreferrer"
								>
									<WhatsAppIcon className="h-5 w-5" />
									Pedir orçamento
								</a>
							</Button>
							<Button
								variant="outline"
								size="lg"
								className={styles.press}
								asChild
							>
								<a href="#unidade">Ver a loja</a>
							</Button>
						</div>

						<ul className={styles.trust}>
							<li className={styles.trustItem}>
								<MapPin
									className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
									aria-hidden="true"
								/>
								<p>
									Loja física
									<span>Santa Efigênia, BH</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Clock
									className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
									aria-hidden="true"
								/>
								<p>
									Horário
									<span>Segunda a sábado</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Shield
									className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
									aria-hidden="true"
								/>
								<p>
									Garantia
									<span>Nos produtos da loja</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Store
									className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
									aria-hidden="true"
								/>
								<p>
									Orçamento
									<span>Pelo WhatsApp, sem custo</span>
								</p>
							</li>
						</ul>
					</div>
				</section>

				<section
					id="produtos"
					className={styles.section}
					aria-labelledby="produtos-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Produtos</p>
							<h2 id="produtos-titulo">O que você encontra na loja</h2>
							<p>
								Peças e acessórios para o dia a dia do aparelho. Envie o modelo
								no WhatsApp e receba as opções com preço.
							</p>
						</div>
						<div className={`${styles.grid} ${styles.products}`}>
							{lojaProducts.map((product, index) => {
								const Icon = productIcons[index] ?? Smartphone
								return (
									<article key={product.title} className={styles.card}>
										<div className={styles.icon}>
											<Icon className="h-5 w-5" aria-hidden="true" />
										</div>
										<h3>{product.title}</h3>
										<p>{product.description}</p>
									</article>
								)
							})}
						</div>
					</div>
				</section>

				<section
					id="linhas"
					className={`${styles.section} ${styles.sectionMuted}`}
					aria-labelledby="linhas-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Linhas</p>
							<h2 id="linhas-titulo">iPhone, Android e tablets</h2>
							<p>
								Separado por linha para você achar mais rápido. A
								compatibilidade é confirmada antes de separar o item.
							</p>
						</div>
						<div className={`${styles.grid} ${styles.lines}`}>
							{lojaLines.map((line, index) => {
								const Icon = lineIcons[index] ?? Smartphone
								return (
									<article key={line.title} className={styles.line}>
										<Icon className="mb-4 h-6 w-6" aria-hidden="true" />
										<h3>{line.title}</h3>
										<p>{line.description}</p>
									</article>
								)
							})}
						</div>
					</div>
				</section>

				<section
					id="diferenciais"
					className={styles.section}
					aria-labelledby="diferenciais-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Diferenciais</p>
							<h2 id="diferenciais-titulo">Por que comprar na Conectize</h2>
							<p>
								Loja organizada, conversa direta e clareza no que você está
								levando.
							</p>
						</div>
						<div className={`${styles.grid} ${styles.highlights}`}>
							{lojaHighlights.map((item) => (
								<article
									key={item.title}
									className={`${styles.card} ${styles.highlight}`}
								>
									<h3>{item.title}</h3>
									<p>{item.description}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section
					id="unidade"
					className={`${styles.section} ${styles.sectionMuted}`}
					aria-labelledby="unidade-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.storeGrid}>
							<div className={styles.storeCopy}>
								<p className={styles.kicker}>Unidade</p>
								<h2 id="unidade-titulo">Visite a loja em Santa Efigênia</h2>
								<p>
									Atendimento presencial em Belo Horizonte. Se preferir, chame
									no WhatsApp para confirmar estoque e horário antes de vir.
								</p>
							</div>
							<ul className={styles.storeMeta}>
								<li className={styles.metaRow}>
									<MapPin
										className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
										aria-hidden="true"
									/>
									<div>
										<p className="m-0 font-semibold text-foreground">
											{business.address.streetAddress}
										</p>
										<p className="mt-1">
											{business.address.neighborhood},{' '}
											{business.address.addressLocality} -{' '}
											{business.address.addressRegion}{' '}
											{business.address.postalCode}
										</p>
										<a
											href={business.hasMap}
											target="_blank"
											rel="noopener noreferrer"
										>
											Abrir no Google Maps
										</a>
									</div>
								</li>
								<li className={styles.metaRow}>
									<Clock
										className="mt-0.5 h-5 w-5 shrink-0 text-primary-accessible"
										aria-hidden="true"
									/>
									<div>
										{hours.map((item) => (
											<p key={item}>{item}</p>
										))}
									</div>
								</li>
							</ul>
						</div>
					</div>
				</section>

				<section className={styles.section} aria-labelledby="faq-titulo">
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Dúvidas</p>
							<h2 id="faq-titulo">Perguntas frequentes</h2>
						</div>
						<div className={styles.faq}>
							{lojaFaq.map((item) => (
								<article key={item.q} className={styles.faqItem}>
									<h3>{item.q}</h3>
									<p>{item.a}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section
					id="contato"
					className={styles.section}
					aria-labelledby="contato-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.ctaBand}>
							<h2 id="contato-titulo">Peça seu orçamento agora</h2>
							<p>
								Informe o modelo do aparelho e o produto que você procura.
								Respondemos pelo WhatsApp com as opções da loja.
							</p>
							<div className={styles.ctaActions}>
								<Button
									variant="whatsapp"
									size="lg"
									className={styles.press}
									asChild
								>
									<a
										href={lojaWhatsAppHref}
										target="_blank"
										rel="noopener noreferrer"
									>
										<WhatsAppIcon className="h-5 w-5" />
										Falar no WhatsApp
									</a>
								</Button>
								<Button
									variant="outline"
									size="lg"
									className={styles.press}
									asChild
								>
									<a href={`tel:${business.phone}`}>
										Ligar {business.phoneDisplay}
									</a>
								</Button>
							</div>
						</div>
					</div>
				</section>
			</main>
		</LojaShell>
	)
}
