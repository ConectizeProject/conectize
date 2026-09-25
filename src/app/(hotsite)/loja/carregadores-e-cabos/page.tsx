import {
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Carregadores e cabos USB-C e Lightning em Belo Horizonte. Fontes e kits de carga com pronta entrega na loja em Santa Efigênia.'

export const metadata = lojaCategoryMetadata({
	title: 'Carregadores e Cabos em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.carregadores,
	keywords:
		'carregador iphone belo horizonte, cabo usb-c bh, cabo lightning, fonte celular santa efigenia',
})

export default function LojaCarregadoresPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.carregadores}
			description={description}
			heroTitle="Carregadores e cabos"
			heroSubtitle="Fontes, cabos USB-C e Lightning, e kits de carga para mesa, carro ou viagem."
			whatsappMessage="Olá! Vim pelo site e quero ver opções de carregadores e cabos para ___"
			models={[
				'Fontes',
				'Cabos USB-C',
				'Cabos Lightning',
				'Kits de carga',
			]}
			modelsTitle="O que trabalhamos"
			modelsLead="Envie o aparelho e o tipo de cabo no WhatsApp para ver as opções."
			modelsAnchorLabel="Ver categorias"
			highlights={[
				{
					title: 'Pronta entrega',
					description: 'Itens de carga dos modelos mais pedidos.',
					icon: 'clock',
				},
				{
					title: 'USB-C e Lightning',
					description: 'Cabos e fontes para o seu aparelho.',
					icon: 'package',
				},
				{
					title: 'Atendimento pelo WhatsApp',
					description: 'Envie o que precisa e veja o estoque.',
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
					q: 'Tem cabo Lightning e USB-C?',
					a: 'Sim. Envie o modelo do aparelho no WhatsApp e confirmamos o cabo e a fonte compatíveis.',
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
