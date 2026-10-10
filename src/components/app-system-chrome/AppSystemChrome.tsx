import Image from 'next/image'
import Link from 'next/link'
import { CANONICAL_SITE_ORIGIN } from '@/lib/utils/site-url'

type AppSystemChromeProps = {
	children: React.ReactNode
}

/**
 * Chrome do sistema no host app: marca Conectize, sem menu da loja.
 * O único link da loja sai para https://www.conectize.com.br.
 */
export function AppSystemChrome({ children }: AppSystemChromeProps) {
	const year = new Date().getFullYear()

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header className="border-b border-border bg-background">
				<div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
					<Link
						href="/planos"
						className="flex items-center gap-2"
						aria-label="Conectize, planos do sistema"
					>
						<Image
							src="/logo_conectize.svg"
							alt=""
							width={120}
							height={118}
							className="h-8 w-auto"
							priority
							sizes="120px"
						/>
						<span className="text-sm font-semibold text-foreground">
							Sistema
						</span>
					</Link>
					<nav
						className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm"
						aria-label="Sistema"
					>
						<Link
							href="/planos"
							className="text-muted-foreground hover:text-foreground"
						>
							Planos
						</Link>
						<Link href="/portal/login" className="font-medium text-foreground">
							Entrar
						</Link>
						<a
							href={CANONICAL_SITE_ORIGIN}
							className="text-muted-foreground hover:text-foreground"
						>
							Site da loja
						</a>
					</nav>
				</div>
			</header>
			{children}
			<footer className="border-t border-border">
				<div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
					<span>© {year} Conectize</span>
					<a href={CANONICAL_SITE_ORIGIN} className="hover:text-foreground">
						Site da loja
					</a>
				</div>
			</footer>
		</div>
	)
}
