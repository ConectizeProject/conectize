import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
	lojaTestimonials,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Vidro traseiro para iPhone 11 ao 17, incluindo Pro e Pro Max. Peças novas com pronta entrega em Santa Efigênia, BH. Consulte pelo WhatsApp.'

export const metadata = lojaCategoryMetadata({
	title: 'Vidro Traseiro para iPhone 11 ao 17 em Belo Horizonte | Conectize',
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
			heroTitle="Vidro traseiro para iPhone"
			heroSubtitle="Peças novas do iPhone 11 ao 17, incluindo Pro e Pro Max, com pronta entrega na loja. Vidro traseiro e tampa traseira são a mesma peça."
			whatsappMessage="Olá! Vim pelo site e quero o preço do vidro traseiro para iPhone ___"
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
					title: 'Pronta entrega',
					description: 'Retire na loja em Santa Efigênia.',
					icon: 'clock',
				},
				{
					title: 'Loja física em Santa Efigênia',
					description: 'R. Padre Rolim, 620.',
					icon: 'store',
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
