import {
	lojaCategoryPaths,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Capinhas, películas, carregadores e cabos para iPhone e Android. Pronta entrega na loja em Santa Efigênia, BH.'

export const metadata = lojaCategoryMetadata({
	title: 'Acessórios para Celular em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.acessorios,
	keywords:
		'acessorios para celular belo horizonte, capinha iphone bh, pelicula de vidro bh, carregador iphone, cabo usb-c lightning, loja santa efigenia',
})

export default function LojaAcessoriosPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.acessorios}
			description={description}
			heroTitle="Acessórios para celular"
			heroSubtitle="Capinhas, películas, carregadores e cabos com pronta entrega."
			whatsappMessage="Olá! Vim pelo site e quero ver opções de acessórios para ___"
			models={[
				'Capinhas',
				'Películas de vidro',
				'Carregadores',
				'Cabos USB-C',
				'Cabos Lightning',
			]}
			modelsTitle="O que trabalhamos"
			modelsLead="Categorias com pronta entrega na loja. Envie o modelo no WhatsApp para ver as opções."
			modelsAnchorLabel="Ver categorias"
			highlights={[
				{
					title: 'Pronta entrega',
					description: 'Capinhas, películas, carregadores e cabos na loja.',
					icon: 'clock',
				},
				{
					title: 'Modelos para iPhone e Android',
					description: 'Opções para as duas linhas.',
					icon: 'devices',
				},
				{
					title: 'Atendimento pelo WhatsApp',
					description: 'Envie o modelo e veja o que temos.',
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
					q: 'Os acessórios estão disponíveis na hora?',
					a: 'A maior parte sai com pronta entrega. Envie o modelo no WhatsApp para confirmar o que temos na loja.',
				},
				{
					q: 'Posso retirar na loja?',
					a: lojaPickupAnswer,
				},
				{
					q: 'Quais as formas de pagamento?',
					// TODO: preencher formas de pagamento
					a: 'TODO: preencher formas de pagamento',
				},
			]}
		/>
	)
}
