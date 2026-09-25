import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Telas e displays para iPhone e Android em Belo Horizonte. Opções de custo-benefício com pronta entrega na loja em Santa Efigênia.'

export const metadata = lojaCategoryMetadata({
	title: 'Telas e Displays para Celular em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.telas,
	keywords:
		'tela iphone belo horizonte, display celular bh, tela android bh, display iphone, loja santa efigenia',
})

export default function LojaTelasDisplaysPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.telas}
			description={description}
			heroTitle="Telas e displays"
			heroSubtitle="Displays para iPhone e Android, com opções para você escolher o melhor custo-benefício."
			whatsappMessage="Olá! Vim pelo site e quero o preço da tela / display para ___"
			models={iphoneModels}
			modelsTitle="Modelos de iPhone"
			modelsLead="Também trabalhamos com displays Android. Envie a marca e o modelo no WhatsApp."
			highlights={[
				{
					title: 'Peças novas',
					description: 'Displays com opções de qualidade e preço.',
					icon: 'package',
				},
				{
					title: 'iPhone e Android',
					description: 'Confirme a compatibilidade pelo WhatsApp.',
					icon: 'devices',
				},
				{
					title: 'Pronta entrega',
					description: 'Retire na loja quando houver estoque.',
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
					q: 'Vocês têm tela para iPhone e Android?',
					a: 'Sim. Envie a marca e o modelo no WhatsApp para confirmarmos as opções e o valor.',
				},
				{
					q: 'Como sei o preço?',
					a: 'Informe o modelo do aparelho no WhatsApp e respondemos com as opções disponíveis.',
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
