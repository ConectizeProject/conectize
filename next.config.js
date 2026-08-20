/** @type {import('next').NextConfig} */
function buildSecurityHeaders () {
	const headers = [
		{ key: 'X-DNS-Prefetch-Control', value: 'on' },
		{ key: 'X-Content-Type-Options', value: 'nosniff' },
		{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
		{
			key: 'Referrer-Policy',
			value: 'strict-origin-when-cross-origin',
		},
		{
			key: 'Permissions-Policy',
			value:
				'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
		},
		{
			key: 'Content-Security-Policy',
			value: "frame-ancestors 'self'",
		},
	]
	// HSTS só em produção (evita bloquear dev em http://localhost)
	if (process.env.NODE_ENV === 'production') {
		headers.push({
			key: 'Strict-Transport-Security',
			value: 'max-age=31536000; includeSubDomains; preload',
		})
	}
	return headers
}

const nextConfig = {
	reactStrictMode: true,
	experimental: {
		viewTransition: true,
	},
	// sharp 0.35 + Turbopack no Vercel: libvips não entra no bundle → 500 HTML em upload.
	serverExternalPackages: ['sharp'],
	outputFileTracingIncludes: {
		'/api/**/*': [
			'./node_modules/@img/sharp-libvips-linux-x64/**/*',
			'./node_modules/@img/sharp-libvips-linuxmusl-x64/**/*',
			'./node_modules/@img/sharp-linux-x64/**/*',
			'./node_modules/@img/sharp-linuxmusl-x64/**/*',
		],
	},
	images: {
		formats: ['image/avif', 'image/webp'],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'm.media-amazon.com',
			},
			{
				protocol: 'https',
				hostname: 'http2.mlstatic.com',
			},
			{
				protocol: 'https',
				hostname: 'elastobor.vtexassets.com',
			},
			{
				protocol: 'https',
				hostname: 'nacionalsmart.com.br',
			},
			/** Imagens externas do Bling / lojas (ex.: Tray — images.tcdn.com.br) */
			{
				protocol: 'https',
				hostname: '**.tcdn.com.br',
			},
			{
				protocol: 'https',
				hostname: '**.bling.com.br',
			},
		],
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
			'troca-de-vidro-tampa-traseira',
			'troca-de-bateria',
			'reparo-de-placa',
			'troca-de-conector',
			'troca-de-camera',
			'correcoes-de-software',
			'reparo-de-audio',
			'reparo-de-agua',
		]

		// Host canônico: apex → www em 308 (Vercel sozinho usa 307 e o GSC conta como 302)
		const hostRedirects = [
			{
				source: '/:path*',
				has: [{ type: 'host', value: 'conectize.com.br' }],
				destination: 'https://www.conectize.com.br/:path*',
				permanent: true,
			},
		]

		// Só 1 segmento aqui: next.config não consegue montar slug com hífen
		// (ex.: troca-de-bateria-samsung-galaxy-a54). Multi-segmento fica no proxy + catch-all.
		const serviceRedirects = serviceSlugs.map((serviceSlug) => ({
			source: `/servicos/${serviceSlug}`,
			destination: `/servicos?servico=${serviceSlug}`,
			permanent: true,
		}))

		// Portal: URLs antigas de seminovos → listagem unificada de revenda
		const legacyPortalRedirects = [
			{
				source: '/portal/seminovos',
				destination: '/portal/revendaaparelhos',
				permanent: true,
			},
			{
				source: '/portal/seminovos/:path*',
				destination: '/portal/revendaaparelhos',
				permanent: true,
			},
			{
				source: '/portal/revendaaparelhos/seminovos',
				destination: '/portal/revendaaparelhos',
				permanent: true,
			},
		]

		// URLs fantasma de loja/ML antiga + home legado (~45% dos 404 do GSC)
		const legacyStoreRedirects = [
			{
				// path-to-regexp (Next 16) rejeita '/MLB-:path*' — repeat precisa de prefixo/sufixo.
				// IDs ML são um segmento: /MLB-1234567890
				source: '/MLB-:id',
				destination: '/acessorios',
				permanent: true,
			},
			{
				source: '/lista/:path*',
				destination: '/acessorios',
				permanent: true,
			},
			{
				source: '/:slug/p/MLB:id',
				destination: '/acessorios',
				permanent: true,
			},
			{
				source: '/p/MLB:id',
				destination: '/acessorios',
				permanent: true,
			},
			{
				source: '/home',
				destination: '/',
				permanent: true,
			},
			{
				source: '/HOME',
				destination: '/',
				permanent: true,
			},
		]

		return [
			...hostRedirects,
			...serviceRedirects,
			...legacyPortalRedirects,
			...legacyStoreRedirects,
		]
	},
	async headers () {
		return [
			{
				source: '/:path*',
				headers: buildSecurityHeaders(),
			},
		]
	},
}

module.exports = nextConfig



