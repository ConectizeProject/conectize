import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
	lojaTestimonials,
	lojaWhatsAppMessages,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Vidro e tampa traseira para iPhone 11 ao 17, incluindo Pro e Pro Max. Pronto em cerca de 6 horas. Retire na loja em Santa Efigênia, BH. Consulte pelo WhatsApp.'

export const metadata = lojaCategoryMetadata({
	title: 'Vidro e Tampa Traseira para iPhone 11 ao 17 em BH | Conectize',
	description,
	path: lojaCategoryPaths.vidro,
	keywords:
		'vidro traseiro iphone belo horizonte, tampa traseira iphone bh, vidro traseiro iphone 11, vidro traseiro iphone 17, loja santa efigenia',
})

export default function LojaVidroTraseiroIphonePage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.vidro}
			description={description}
			heroTitle="Vidro e tampa traseira para iPhone"
			heroSubtitle="Peças novas do iPhone 11 ao 17, incluindo Pro e Pro Max. Vidro traseiro e tampa traseira são a mesma peça."
			heroImage={{
				src: '/loja/vidro-traseiro-iphone-hero.webp',
				width: 768,
				height: 1024,
				alt: 'iPhone com o vidro traseiro trincado e tampa de reposição',
			}}
			heroCallouts={[
				{ title: 'Pronto em cerca de 6 horas', icon: 'clock' },
				{ title: 'Retire na loja em Santa Efigênia', icon: 'store' },
			]}
			reviewsAfterHero
			nav={[
				{ href: '#avaliacoes', label: 'Avaliações' },
				{ href: '#modelos', label: 'Modelos' },
				{ href: '#diferenciais', label: 'Diferenciais' },
				{ href: '#unidade', label: 'Loja' },
				{ href: '#contato', label: 'Contato' },
			]}
			whatsappMessage={lojaWhatsAppMessages.vidro}
			models={iphoneModels}
			modelsLead="Referência dos modelos com vidro traseiro / tampa traseira na loja. Envie o modelo e a cor no WhatsApp."
			highlights={[
				{
					title: 'Peças novas',
					description: 'Vidro traseiro novo para o modelo do seu iPhone.',
					icon: 'package',
				},
				{
					title: 'Várias cores por modelo',
					description: 'Escolha a cor e confirme pelo WhatsApp.',
					icon: 'palette',
				},
				{
					title: 'Pronto em cerca de 6 horas',
					description: 'O serviço fica pronto no mesmo dia, em cerca de 6 horas.',
					icon: 'clock',
					featured: true,
				},
				{
					title: 'Retire na loja em Santa Efigênia',
					description: 'R. Padre Rolim, 620.',
					icon: 'store',
					featured: true,
				},
			]}
			faq={[
				{
					q: 'Quais modelos vocês têm?',
					a: 'Do iPhone 11 ao iPhone 17, incluindo Pro e Pro Max.',
				},
				{
					q: 'Também chamam de tampa traseira?',
					a: 'Sim, vidro traseiro e tampa traseira são a mesma peça.',
				},
				{
					q: 'É a mesma peça do vidro da tela?',
					a: 'Não. O vidro da tela fica na frente do iPhone. O vidro traseiro, ou tampa traseira, fica na parte de trás.',
				},
				{
					q: 'Como sei o preço?',
					a: 'Envie o modelo e a cor no WhatsApp e respondemos com o valor.',
				},
				{
					q: 'Posso retirar na loja?',
					a: lojaPickupAnswer,
				},
				{
					q: 'Vocês são loja oficial da Apple?',
					a: lojaIndependentAnswer,
				},
			]}
			testimonials={lojaTestimonials.filter(
				(item) => !item.quote.toLowerCase().includes('garantia'),
			)}
		/>
	)
}
