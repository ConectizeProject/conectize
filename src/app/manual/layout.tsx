import { AppSystemChrome } from '@/components/app-system-chrome/AppSystemChrome'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { getRequestSurface } from '@/lib/utils/request-surface'

export default async function ManualLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const surface = await getRequestSurface()
	const skipLink = (
		<a
			href="#conteudo-principal"
			className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
		>
			Pular para o conteúdo principal
		</a>
	)

	if (surface === 'app') {
		return (
			<AppSystemChrome>
				{skipLink}
				<main id="conteudo-principal" className="flex-1">
					{children}
				</main>
			</AppSystemChrome>
		)
	}

	return (
		<div className="min-h-screen flex flex-col">
			<Header />
			{skipLink}
			<main id="conteudo-principal" className="flex-1">
				{children}
			</main>
			<Footer />
		</div>
	)
}
