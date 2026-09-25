import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Bateria nova para iPhone 11 ao 17, incluindo Pro e Pro Max. Pronta entrega na loja em Santa Efigênia, BH. Consulte o preço pelo WhatsApp.'

export const metadata = lojaCategoryMetadata({
	title: 'Bateria para iPhone 11 ao 17 em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.bateria,
	keywords:
		'bateria iphone belo horizonte, bateria iphone bh, bateria iphone 11, bateria iphone 17, bateria iphone pro max, loja santa efigenia',
})

export default function LojaBateriaIphonePage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.bateria}
			description={description}
			heroTitle="Bateria nova para iPhone"
			heroSubtitle="Do iPhone 11 ao 17, incluindo Pro e Pro Max. Pronta entrega e 12 meses de garantia na peça."
			whatsappMessage="Olá! Vim pelo site e quero o preço da bateria para iPhone ___"
			models={iphoneModels}
			modelsLead="Referência dos modelos de iPhone com bateria na loja. Envie o seu no WhatsApp para confirmar disponibilidade e preço."
			highlights={[
				{
					title: 'Peça nova',
					description: 'Bateria nova para o modelo do seu iPhone.',
					icon: 'package',
				},
				{
					title: '12 meses de garantia na bateria',
					description: 'Cobertura de 12 meses na peça.',
					icon: 'shield',
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
					q: 'Quais modelos de bateria vocês têm?',
					a: 'Do iPhone 11 ao iPhone 17, incluindo as versões Pro e Pro Max. Envie o modelo no WhatsApp para confirmar a disponibilidade.',
				},
				{
					q: 'Quais sinais indicam que a bateria está cansada?',
					a: 'Autonomia caiu muito, desligamento inesperado, aquecimento, carga oscilando ou bateria inchada. Em caso de inchaço, evite pressionar o aparelho e fale conosco pelo WhatsApp.',
				},
				{
					q: 'Qual a garantia da bateria?',
					a: '12 meses de garantia na peça. A cobertura vale para falhas de fabricação da bateria.',
				},
				{
					q: 'Como sei o preço?',
					a: 'Envie o modelo do seu iPhone no WhatsApp e respondemos com o valor.',
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
		/>
	)
}
