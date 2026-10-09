/** @type {import('next').NextConfig} */
function buildSecurityHeaders() {
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
		// Desligado: no Safari/iOS as View Transitions escondiam o header do portal
		// em rotas como OS e aparelhos e não restauravam a visibilidade.
		viewTransition: false,
	},
	// A barra final é resolvida no middleware junto com o destino canônico,
	// para não criar uma cadeia (slash → path antigo → URL final).
	skipTrailingSlashRedirect: true,
	// sharp 0.35 + Turbopack no Vercel: libvips não entra no bundle → 500 HTML em upload.
	// pdfkit precisa do .afm em node_modules (não no virtual root C:\ROOT do bundler).
	serverExternalPackages: ['sharp', 'pdfkit', '@brasil-fiscal/nfe', 'qrcode'],
	outputFileTracingIncludes: {
		'/api/**/*': [
			'./node_modules/@img/sharp-libvips-linux-x64/**/*',
			'./node_modules/@img/sharp-libvips-linuxmusl-x64/**/*',
			'./node_modules/@img/sharp-linux-x64/**/*',
			'./node_modules/@img/sharp-linuxmusl-x64/**/*',
			'./node_modules/pdfkit/js/data/**/*',
		],
	},
	images: {
		// O src de fallback do next/image é o maior deviceSize. Sem este teto, o hero da loja saía em w=3840.
		deviceSizes: [640, 750, 828, 1080, 1200, 1920],
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
			'next/dist/build/polyfills/polyfill-module':
				'./src/lib/modern-polyfill.js',
		},
	},
	async redirects() {
		// Apex, http, serviços legados, MLB e barra final ficam no middleware,
		// num único 301 absoluto. Um redirect aqui preservaria o path antigo
		// (e, no caso de /servicos/{slug}, a query ?servico=) e criaria cadeia.
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

		return legacyPortalRedirects
	},
	async headers() {
		return [
			{
				source: '/:path*',
				headers: buildSecurityHeaders(),
			},
		]
	},
}

module.exports = nextConfig
