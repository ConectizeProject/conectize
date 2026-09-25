import {
	Battery,
	Cable,
	Clock,
	Headphones,
	MapPin,
	Monitor,
	RectangleHorizontal,
	Shield,
	ShoppingBag,
	Smartphone,
	Square,
	Store,
	Tablet,
	type LucideIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
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
import { HeroBrokenPhone } from './HeroBrokenPhone'
import { LojaContactCta } from './LojaContactCta'
import { LojaReviews } from './LojaReviews'
import { LojaShell } from './LojaShell'
import { LojaStoreSection } from './LojaStoreSection'
import { LojaWhatsAppLink } from './LojaWhatsAppLink'
import styles from './loja.module.css'
import { WhatsAppIcon } from './WhatsAppIcon'

const productIcons: Record<string, LucideIcon> = {
	'Telas e displays': Monitor,
	'Vidro frontal': Square,
	Baterias: Battery,
	'Vidro traseiro': RectangleHorizontal,
	Capinhas: Shield,
	Películas: Smartphone,
	'Carregadores e cabos': Cable,
	'Áudio e extras': Headphones,
	Acessórios: ShoppingBag,
}
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
					<div className={styles.heroStage}>
						<div className={styles.heroScrim} aria-hidden="true" />
					</div>

					<div className={styles.heroInner}>
						<div className={styles.heroCopy}>
							<p className={styles.heroIntro}>{lojaCopy.heroIntro}</p>
							<h1 id="loja-titulo" className={styles.display}>
								<span className={styles.heroLine}>{lojaCopy.heroLine}</span>
								<span className={styles.shine}>{lojaCopy.heroShine}</span>
							</h1>
							<p className={styles.lead}>{lojaCopy.heroLead}</p>
							<div className={styles.actions}>
								<LojaWhatsAppLink
									className={styles.ctaWhatsapp}
									href={lojaWhatsAppHref}
									placement="hero"
								>
									<WhatsAppIcon className="h-5 w-5" />
									Pedir orçamento
								</LojaWhatsAppLink>
								<a className={styles.ctaGhost} href="#unidade">
									Ver a loja
								</a>
							</div>
						</div>
						<HeroBrokenPhone />
						<ul className={styles.trust}>
							<li className={styles.trustItem}>
								<MapPin
									className={`${styles.accentIcon} h-5 w-5`}
									aria-hidden="true"
								/>
								<p>
									Loja física
									<span>Santa Efigênia, BH</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Clock
									className={`${styles.accentIcon} h-5 w-5`}
									aria-hidden="true"
								/>
								<p>
									Horário
									<span>Segunda a sábado</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Shield
									className={`${styles.accentIcon} h-5 w-5`}
									aria-hidden="true"
								/>
								<p>
									Garantia
									<span>Nos produtos da loja</span>
								</p>
							</li>
							<li className={styles.trustItem}>
								<Store
									className={`${styles.accentIcon} h-5 w-5`}
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
							{lojaProducts.map((product) => {
								const Icon = productIcons[product.title] ?? Smartphone
								return (
									<Link
										key={product.title}
										href={product.href}
										className={`${styles.card} ${styles.cardLink}`}
									>
										<div className={styles.icon}>
											<Icon className="h-5 w-5" aria-hidden="true" />
										</div>
										<h3>{product.title}</h3>
										<p>{product.description}</p>
									</Link>
								)
							})}
						</div>
					</div>
				</section>

				<section
					id="linhas"
					className={`${styles.section} ${styles.sectionAlt}`}
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
										<Icon
											className={`${styles.accentIcon} mb-4 h-6 w-6`}
											aria-hidden="true"
										/>
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

				<LojaReviews />
				<LojaStoreSection />

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

				<LojaContactCta />
			</main>
		</LojaShell>
	)
}
