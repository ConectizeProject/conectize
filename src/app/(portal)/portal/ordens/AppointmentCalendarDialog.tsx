'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'

type SlotOrder = {
	id: string
	displayNumber: number | null
	model: string
	customerName: string
	reviewed: boolean
}

type Slot = {
	startsAt: string
	label: string
	orders: SlotOrder[]
}

function todayKey () {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date())
}

export function AppointmentCalendarDialog () {
	const [open, setOpen] = useState(false)
	const [date, setDate] = useState(todayKey())
	const [slots, setSlots] = useState<Slot[]>([])
	const [loading, setLoading] = useState(false)

	async function load (nextDate: string) {
		setLoading(true)
		try {
			const response = await fetch(`/api/portal/agendamentos?date=${encodeURIComponent(nextDate)}`)
			const payload = await response.json() as { slots?: Slot[] }
			setSlots(payload.slots ?? [])
		} catch {
			setSlots([])
		} finally {
			setLoading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => {
			setOpen(next)
			if (next) void load(date)
		}}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto">
					<Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
					Calendário
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Agendamentos do dia</DialogTitle>
				</DialogHeader>
				<label className="grid gap-1 text-sm font-medium">
					Dia
					<input
						type="date"
						className="h-10 rounded-md border bg-background px-3"
						value={date}
						onChange={(event) => {
							const next = event.target.value
							setDate(next)
							void load(next)
						}}
					/>
				</label>
				{loading ? <p className="text-sm text-muted-foreground">Carregando horários.</p> : null}
				{!loading && slots.length === 0 ? (
					<p className="text-sm text-muted-foreground">A loja não agenda neste dia.</p>
				) : null}
				<ul className="grid gap-2">
					{slots.map((slot) => (
						<li key={slot.startsAt} className="rounded-lg border px-3 py-2">
							<p className="text-sm font-semibold">{slot.label}</p>
							{slot.orders.length === 0 ? (
								<p className="text-sm text-muted-foreground">Livre</p>
							) : slot.orders.map((order) => (
								<Link
									key={order.id}
									href={getOrdemPortalPath({ id: order.id, display_number: order.displayNumber })}
									className="mt-1 block text-sm underline-offset-4 hover:underline"
								>
									{order.customerName} · {order.model}
									{order.displayNumber != null ? ` · #${order.displayNumber}` : ''}
									{order.reviewed ? '' : ' · revisar'}
								</Link>
							))}
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	)
}
