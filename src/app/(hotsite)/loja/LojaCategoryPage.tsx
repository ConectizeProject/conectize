import {
	Clock,
	MapPin,
	MessageCircle,
	Package,
	Palette,
	ShieldCheck,
	Smartphone,
	type LucideIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import {
	getLojaCategoryFaqJsonLd,
	getLojaCategoryStoreJsonLd,
	lojaCategoryAddress,
	lojaCopy,
	whatsappLink,
} from '@/lib/data/hotsite-loja'
import { getSiteUrl } from '@/lib/utils/site-url'
import { LojaContactCta } from './LojaContactCta'
import { LojaReviews } from './LojaReviews'
import { LojaShell } from './LojaShell'
import {
	lojaCategoryLocalityLine,
	LojaStoreSection,
} from './LojaStoreSection'
import { LojaWhatsAppLink } from './LojaWhatsAppLink'
import styles from './loja.module.css'
import { WhatsAppIcon } from './WhatsAppIcon'

const highlightIcons = {
	package: Package,
	shield: ShieldCheck,
	clock: Clock,
	store: MapPin,
	palette: Palette,
	message: MessageCircle,
	devices: Smartphone,
} as const

type HighlightIcon = keyof typeof highlightIcons

const defaultNav = [
	{ href: '#diferenciais', label: 'Diferenciais' },
	{ href: '#avaliacoes', label: 'Avaliações' },
	{ href: '#unidade', label: 'Loja' },
	{ href: '#contato', label: 'Contato' },
] as const

export type LojaCategoryHighlight = {
	title: string
	description: string
	icon: HighlightIcon
}

export type LojaCategoryFaq = {
	q: string
	a: string
}

export type LojaCategoryReview = {
	name: string
	quote: string
}

type LojaCategoryPageProps = {
	path: string
	description: string
	heroTitle: string
	heroSubtitle: string
	whatsappMessage: string
	highlights: readonly LojaCategoryHighlight[]
	faq: readonly LojaCategoryFaq[]
	models?: readonly string[]
	modelsTitle?: string
	modelsLead?: string
	modelsAnchorLabel?: string
	testimonials?: readonly LojaCategoryReview[]
	nav?: readonly { href: string; label: string }[]
}

export function lojaCategoryMetadata (input: {
	title: string
	description: string
	path: string
	keywords: string
}): Metadata {
	const url = `${getSiteUrl()}${input.path}`

	return {
		title: input.title,
		description: input.description,
		keywords: input.keywords,
		robots: {
			index: true,
			follow: true,
		},
		alternates: {
			canonical: url,
		},
		openGraph: {
			type: 'website',
			title: input.title,
			description: input.description,
			url,
			siteName: lojaCopy.brand,
			locale: 'pt_BR',
		},
	}
}

export function LojaCategoryPage ({
	path,
	description,
	heroTitle,
	heroSubtitle,
	whatsappMessage,
	highlights,
	faq,
	models,
	modelsTitle = 'Modelos disponíveis',
	modelsLead = 'Referência dos modelos que trabalhamos na loja.',
	modelsAnchorLabel = 'Ver modelos',
	testimonials,
	nav,
}: LojaCategoryPageProps) {
	const href = whatsappLink(whatsappMessage)
	const hasModels = Boolean(models?.length)
	const resolvedNav = nav ?? (
		hasModels
			? [
					{ href: '#modelos', label: 'Modelos' },
					...defaultNav,
				]
			: defaultNav
	)

	return (
		<LojaShell navBase="" whatsappHref={href} nav={resolvedNav}>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(
						getLojaCategoryStoreJsonLd({ path, description }),
					),
				}}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(getLojaCategoryFaqJsonLd(faq)),
				}}
			/>

			<main id="conteudo-principal">
				<section
					className={`${styles.hero} ${styles.heroCentered}`}
					aria-labelledby="categoria-titulo"
				>
					<div className={styles.heroStage}>
						<div className={styles.heroScrim} aria-hidden="true" />
					</div>
					<div className={styles.heroCenteredInner}>
						<p className={styles.heroIntro}>
							Loja em Santa Efigênia, Belo Horizonte.
						</p>
						<h1 id="categoria-titulo" className={styles.display}>
							<span className={styles.heroLine}>{heroTitle}</span>
						</h1>
						<p className={styles.lead}>{heroSubtitle}</p>
						<div className={styles.actions}>
							<LojaWhatsAppLink
								className={styles.ctaWhatsapp}
								href={href}
								placement="hero"
							>
								<WhatsAppIcon className="h-5 w-5" />
								Consultar no WhatsApp
							</LojaWhatsAppLink>
							<a
								className={styles.ctaGhost}
								href={hasModels ? '#modelos' : '#unidade'}
							>
								{hasModels ? modelsAnchorLabel : 'Ver a loja'}
							</a>
						</div>
					</div>
				</section>

				{hasModels ? (
					<section
						id="modelos"
						className={styles.section}
						aria-labelledby="modelos-titulo"
					>
						<div className={styles.wrap}>
							<div className={styles.sectionHead}>
								<p className={styles.kicker}>Modelos</p>
								<h2 id="modelos-titulo">{modelsTitle}</h2>
								<p>{modelsLead}</p>
							</div>
							<ul className={styles.modelChips}>
								{models?.map((model) => (
									<li key={model}>{model}</li>
								))}
							</ul>
						</div>
					</section>
				) : null}

				<section
					id="diferenciais"
					className={`${styles.section} ${styles.sectionAlt}`}
					aria-labelledby="diferenciais-titulo"
				>
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Diferenciais</p>
							<h2 id="diferenciais-titulo">Por que comprar na Conectize</h2>
						</div>
						<div className={`${styles.grid} ${styles.highlights}`}>
							{highlights.map((item) => {
								const Icon: LucideIcon = highlightIcons[item.icon]
								return (
									<article
										key={item.title}
										className={`${styles.card} ${styles.highlight}`}
									>
										<div className={styles.icon}>
											<Icon className="h-5 w-5" aria-hidden="true" />
										</div>
										<h3>{item.title}</h3>
										<p>{item.description}</p>
									</article>
								)
							})}
						</div>
					</div>
				</section>

				<LojaReviews testimonials={testimonials} />

				<LojaStoreSection
					streetAddress={lojaCategoryAddress.streetAddress}
					localityLine={lojaCategoryLocalityLine}
				/>

				<section className={styles.section} aria-labelledby="faq-titulo">
					<div className={styles.wrap}>
						<div className={styles.sectionHead}>
							<p className={styles.kicker}>Dúvidas</p>
							<h2 id="faq-titulo">Perguntas frequentes</h2>
						</div>
						<div className={styles.faq}>
							{faq.map((item) => (
								<details key={item.q} className={styles.faqDetails}>
									<summary>
										<h3>{item.q}</h3>
									</summary>
									<p>{item.a}</p>
								</details>
							))}
						</div>
					</div>
				</section>

				<LojaContactCta whatsappHref={href} />
			</main>
		</LojaShell>
	)
}
