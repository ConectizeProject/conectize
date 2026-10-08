import { loadPublicBatteryAppointment } from '@/lib/appointments/service'
import {
	iphoneModels,
	lojaCategoryPaths,
	lojaIndependentAnswer,
	lojaPickupAnswer,
	whatsappLink,
} from '@/lib/data/hotsite-loja'
import { getAuthUser } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { LojaCategoryPage, lojaCategoryMetadata } from '../LojaCategoryPage'
import { BatteryBooking, BatteryBookingBand, BatteryBookingTrigger, type BatteryAppointmentSession } from './BateriaAgendamento'

const description =
	'Bateria nova para iPhone 11 ao 17, incluindo Pro e Pro Max. Pronta entrega na loja em Santa Efigênia, BH. Consulte o preço pelo WhatsApp.'

export const metadata = lojaCategoryMetadata({
	title: 'Bateria para iPhone 11 ao 17 em Belo Horizonte | Conectize',
	description,
	path: lojaCategoryPaths.bateria,
	keywords:
		'bateria iphone belo horizonte, bateria iphone bh, bateria iphone 11, bateria iphone 17, bateria iphone pro max, loja santa efigenia',
})

export default async function LojaBateriaIphonePage () {
	let loggedIn = false
	let appointment: BatteryAppointmentSession | null = null
	try {
		const { user } = await getAuthUser()
		loggedIn = Boolean(user?.id)
		if (user?.id) {
			const supabase = createSupabaseServiceClient()
			appointment = await loadPublicBatteryAppointment(supabase, user.id)
		}
	} catch (err) {
		console.error('[bateria-agendamento-session]', err)
	}

	return (
		<BatteryBooking
			models={iphoneModels}
			whatsappHref={whatsappLink('Olá! Vim pelo site e quero agendar a troca de bateria do iPhone.')}
			loggedIn={loggedIn}
			appointment={appointment}
		>
		<LojaCategoryPage
			nav={[
				{ href: '#agendamento', label: 'Agendar' },
				{ href: '#modelos', label: 'Modelos' },
				{ href: '#diferenciais', label: 'Diferenciais' },
				{ href: '#avaliacoes', label: 'Avaliações' },
				{ href: '#unidade', label: 'Loja' },
				{ href: '#contato', label: 'Contato' },
			]}
			heroAction={<BatteryBookingTrigger />}
			afterHero={<BatteryBookingBand />}
			path={lojaCategoryPaths.bateria}
			description={description}
			heroTitle="Bateria nova para iPhone"
			heroSubtitle={(
				<>
					Atendemos todos os modelos de iPhone.
					<br />
					Na hora! Com 12 meses de garantia.
				</>
			)}
			heroImage={{
				src: '/loja/bateria-iphone-hero-branco.webp',
				width: 640,
				height: 1024,
				alt: 'iPhone e bateria de reposição Li-ion',
			}}
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
		</BatteryBooking>
	)
}
