import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { business } from '@/lib/data/business'
import {
	lojaCopy,
	lojaNav,
	lojaPath,
	lojaWhatsAppHref,
} from '@/lib/data/hotsite-loja'
import styles from './loja.module.css'
import { WhatsAppIcon } from './WhatsAppIcon'

export function LojaShell({
	children,
	navBase = lojaPath,
}: {
	children: React.ReactNode
	navBase?: string
}) {
	return (
		<div className={styles.page}>
			<a className={styles.skip} href="#conteudo-principal">
				Pular para o conteúdo principal
			</a>

			<header className={styles.header}>
				<div className={styles.headerInner}>
					<Link
						href={lojaPath}
						className={styles.brand}
						aria-label="Conectize Store"
					>
						<Image
							src="/logo_conectize.svg"
							alt="Conectize Store"
							width={120}
							height={118}
							className="h-8 w-auto"
							priority
							sizes="120px"
						/>
					</Link>

					<nav className={styles.nav} aria-label="Seções da loja">
						{lojaNav.map((item) => (
							<a
								key={item.href}
								href={`${navBase}${item.href}`}
								className={styles.navLink}
							>
								{item.label}
							</a>
						))}
					</nav>

					<div className={styles.headerCta}>
						<Button
							variant="whatsapp"
							size="sm"
							className={styles.press}
							asChild
						>
							<a
								href={lojaWhatsAppHref}
								target="_blank"
								rel="noopener noreferrer"
							>
								<WhatsAppIcon className="h-4 w-4" />
								WhatsApp
							</a>
						</Button>
					</div>
				</div>
			</header>

			{children}

			<footer className={styles.footer}>
				<div className={`${styles.wrap} ${styles.footerInner}`}>
					<div>
						<p>
							© {new Date().getFullYear()} {lojaCopy.brand}. CNPJ{' '}
							{business.cnpj}. Loja de peças e acessórios em Belo Horizonte.
						</p>
						<small className="mt-3">{lojaCopy.disclaimer}</small>
					</div>
					<div className={styles.footerLinks}>
						<a href={`tel:${business.phone}`}>{business.phoneDisplay}</a>
						<a href={business.hasMap} target="_blank" rel="noopener noreferrer">
							Como chegar
						</a>
						<a
							href="https://www.instagram.com/conectizeoficial/"
							target="_blank"
							rel="noopener noreferrer"
						>
							Instagram
						</a>
						<Link href="/loja/privacidade">Política de privacidade</Link>
					</div>
				</div>
			</footer>

			<a
				className={styles.fab}
				href={lojaWhatsAppHref}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Falar no WhatsApp"
			>
				<WhatsAppIcon className="h-5 w-5" />
				<span>Orçamento</span>
			</a>
		</div>
	)
}
