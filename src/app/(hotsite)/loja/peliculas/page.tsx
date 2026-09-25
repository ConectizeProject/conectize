import {
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
} from '@/lib/data/hotsite-loja'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'

const description =
	'Películas de vidro temperado para celular em Belo Horizonte. Proteção contra riscos e impactos leves, com pronta entrega na loja.'

export const metadata = lojaCategoryMetadata({
	title: 'Películas de Vidro para Celular em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.peliculas,
	keywords:
		'pelicula de vidro belo horizonte, pelicula iphone bh, pelicula celular santa efigenia',
})

export default function LojaPeliculasPage () {
	return (
		<LojaCategoryPage
			path={lojaCategoryPaths.peliculas}
			description={description}
			heroTitle="Películas de vidro"
			heroSubtitle="Películas de vidro temperado para manter a tela protegida contra riscos e impactos leves."
			whatsappMessage="Olá! Vim pelo site e quero ver opções de película para ___"
			models={['iPhone', 'Samsung', 'Motorola', 'Xiaomi', 'Outros Android']}
			modelsTitle="Linhas"
			modelsLead="Envie o modelo no WhatsApp para confirmar o recorte certo."
			modelsAnchorLabel="Ver linhas"
			highlights={[
				{
					title: 'Vidro temperado',
					description: 'Proteção para o dia a dia da tela.',
					icon: 'package',
				},
				{
					title: 'iPhone e Android',
					description: 'Recortes conforme o modelo.',
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
					q: 'A película serve no meu modelo?',
					a: 'Envie a marca e o modelo no WhatsApp e confirmamos o recorte disponível.',
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
