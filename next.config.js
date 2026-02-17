/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
		formats: ['image/avif', 'image/webp'],
	},
	// Turbopack: cache em disco para dev mais rápido entre reinícios (Next.js 16)
	experimental: {
		turbopackFileSystemCacheForDev: true,
		// Inline critical CSS para reduzir render-blocking (melhora FCP/LCP)
		inlineCss: true,
	},
	// Remove polyfills legados em navegadores modernos (~14KB economia)
	turbopack: {
		resolveAlias: {
			'../build/polyfills/polyfill-module': './src/lib/modern-polyfill.js',
			'next/dist/build/polyfills/polyfill-module': './src/lib/modern-polyfill.js',
		},
	},
	async redirects() {
		const serviceSlugs = [
			'troca-de-tela',
			'troca-de-vidro-da-tela',
			'troca-de-bateria',
			'reparo-de-placa',
			'troca-de-conector',
			'troca-de-camera',
			'correcoes-de-software',
			'reparo-de-audio',
			'reparo-de-agua',
		]

		return serviceSlugs.flatMap((serviceSlug) => ([
			// Rotas antigas -> nova semântica (marca + serviço + modelo)
			{
				source: `/servicos/${serviceSlug}/:marca/:tipo/:modelo`,
				destination: `/servicos/:marca/${serviceSlug}/:modelo`,
				permanent: true,
			},
			{
				source: `/servicos/${serviceSlug}/:marca/:tipo`,
				destination: `/servicos/:marca/${serviceSlug}`,
				permanent: true,
			},
			{
				source: `/servicos/${serviceSlug}/:marca`,
				destination: `/servicos/:marca/${serviceSlug}`,
				permanent: true,
			},
			{
				source: `/servicos/${serviceSlug}`,
				destination: `/servicos?servico=${serviceSlug}`,
				permanent: true,
			},
		]))
	},
}

module.exports = nextConfig



