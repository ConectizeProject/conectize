import {
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Fones, adaptadores e extras para celular em Belo Horizonte. Acessórios com pronta entrega na loja em Santa Efigênia.'

export const metadata = lojaCategoryMetadata({
	title: 'Áudio e Extras para Celular em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.audio,
	keywords:
		'fone celular belo horizonte, adaptador iphone bh, acessorios audio, loja santa efigenia',
})

export default function LojaAudioExtrasPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.audio}
			description={description}
			heroTitle="Áudio e extras"
			heroSubtitle="Fones, adaptadores e acessórios para completar o aparelho sem surpresa na hora de pagar."
			whatsappMessage="Olá! Vim pelo site e quero ver opções de áudio e extras para ___"
			models={['Fones', 'Adaptadores', 'Extras']}
			modelsTitle="O que trabalhamos"
			modelsLead="Envie o que você procura no WhatsApp para ver o que temos na loja."
			modelsAnchorLabel="Ver categorias"
			highlights={[
				{
					title: 'Pronta entrega',
					description: 'Itens para completar o aparelho na hora.',
					icon: 'clock',
				},
				{
					title: 'Orçamento claro',
					description: 'Preço combinado pelo WhatsApp.',
					icon: 'message',
				},
				{
					title: 'iPhone e Android',
					description: 'Confirme a compatibilidade antes de retirar.',
					icon: 'devices',
				},
				{
					title: 'Loja física em Santa Efigênia',
					description: 'Retire em Belo Horizonte.',
					icon: 'store',
				},
			]}
			faq={[
				{
					q: 'O que entra em áudio e extras?',
					a: 'Fones, adaptadores e outros itens para completar o aparelho. Envie o que precisa no WhatsApp.',
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
