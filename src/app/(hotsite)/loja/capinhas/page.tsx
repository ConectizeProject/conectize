import {
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Capinhas para iPhone e Android em Belo Horizonte. Modelos transparentes, coloridos e reforçados com pronta entrega na loja.'

export const metadata = lojaCategoryMetadata({
	title: 'Capinhas para Celular em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.capinhas,
	keywords:
		'capinha iphone belo horizonte, capa celular bh, capinha android, loja santa efigenia',
})

export default function LojaCapinhasPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.capinhas}
			description={description}
			heroTitle="Capinhas para celular"
			heroSubtitle="Proteção para o dia a dia, com modelos transparentes, coloridos e reforçados."
			whatsappMessage="Olá! Vim pelo site e quero ver opções de capinha para ___"
			models={[
				'Transparentes',
				'Coloridas',
				'Reforçadas',
				'iPhone',
				'Android',
			]}
			modelsTitle="Opções na loja"
			modelsLead="Envie o modelo do aparelho no WhatsApp para ver o que temos disponível."
			modelsAnchorLabel="Ver opções"
			highlights={[
				{
					title: 'Pronta entrega',
					description: 'Capinhas dos modelos mais pedidos na loja.',
					icon: 'clock',
				},
				{
					title: 'iPhone e Android',
					description: 'Confirme a compatibilidade pelo WhatsApp.',
					icon: 'devices',
				},
				{
					title: 'Atendimento pelo WhatsApp',
					description: 'Envie o modelo e veja as opções.',
					icon: 'message',
				},
				{
					title: 'Loja física em Santa Efigênia',
					description: 'Retire em Belo Horizonte.',
					icon: 'store',
				},
			]}
			faq={[
				{
					q: 'Tem capinha para o meu modelo?',
					a: 'Envie a marca e o modelo no WhatsApp e confirmamos o que temos na loja.',
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
