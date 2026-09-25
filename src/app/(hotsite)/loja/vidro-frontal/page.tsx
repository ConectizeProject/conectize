import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Vidro frontal do display para iPhone em Belo Horizonte. Peças novas com pronta entrega na loja em Santa Efigênia. Consulte pelo WhatsApp.'

export const metadata = lojaCategoryMetadata({
	title: 'Vidro Frontal para iPhone em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.vidroFrontal,
	keywords:
		'vidro frontal iphone belo horizonte, vidro frontal display iphone bh, vidro da tela iphone, loja santa efigenia',
})

export default function LojaVidroFrontalPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.vidroFrontal}
			description={description}
			heroTitle="Vidro frontal para iPhone"
			heroSubtitle="Vidro frontal do display, peça nova, com pronta entrega na loja em Santa Efigênia."
			whatsappMessage="Olá! Vim pelo site e quero o preço do vidro frontal para iPhone ___"
			models={iphoneModels}
			modelsLead="Referência dos modelos com vidro frontal na loja. Envie o seu no WhatsApp para confirmar disponibilidade."
			highlights={[
				{
					title: 'Peça nova',
					description: 'Vidro frontal do display para o modelo do iPhone.',
					icon: 'package',
				},
				{
					title: 'Linha Pro e Pro Max',
					description: 'Do iPhone 11 ao 17, incluindo variações.',
					icon: 'devices',
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
					q: 'Vidro frontal é a mesma peça do display completo?',
					a: 'Não. O vidro frontal é a cobertura da frente. O display é o conjunto completo da tela. Envie o modelo no WhatsApp e orientamos a peça certa.',
				},
				{
					q: 'Quais modelos vocês têm?',
					a: 'Do iPhone 11 ao iPhone 17, incluindo Pro e Pro Max. Confirme a disponibilidade pelo WhatsApp.',
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
