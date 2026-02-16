/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
		domains: [],
		formats: ['image/avif', 'image/webp'],
	},
	eslint: {
		ignoreDuringBuilds: true,
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



