'use client'

import { useState } from 'react'
import { formatAppointmentWhen } from '@/lib/appointments/slots'
import { markAppointmentReviewedAction } from './appointment-review-action'

type Props = {
	orderId: string
	startsAt: string
	modelLabel: string | null
	reviewedAt: string | null
}

export function AppointmentReviewBanner ({ orderId, startsAt, modelLabel, reviewedAt }: Props) {
	const [done, setDone] = useState(Boolean(reviewedAt))
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')
	const when = formatAppointmentWhen(startsAt)

	async function review () {
		setPending(true)
		setError('')
		const result = await markAppointmentReviewedAction(orderId)
		setPending(false)
		if (!result.ok) {
			setError('Não foi possível marcar a revisão.')
			return
		}
		setDone(true)
	}

	return (
		<div className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sky-950">
			<p className="text-sm font-semibold">Agendamento online de bateria</p>
			<p className="mt-1 text-sm">
				{modelLabel ? `${modelLabel}. ` : ''}
				{when ? `Horário: ${when}. ` : ''}
				Desconto de 5% já está na OS. Lance o preço da bateria na revisão.
			</p>
			{done ? (
				<p className="mt-2 text-sm font-medium">Revisão concluída. O cliente não altera mais o horário.</p>
			) : (
				<button
					type="button"
					className="mt-3 rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
					disabled={pending}
					onClick={() => { void review() }}
				>
					{pending ? 'Salvando...' : 'Marcar como revisada'}
				</button>
			)}
			{error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
		</div>
	)
}
