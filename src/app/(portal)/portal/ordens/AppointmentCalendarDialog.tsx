'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import {
	addDateKeyDays,
	appointmentInstantKey,
	APPOINTMENT_TIME_ZONE,
	formatDateKeySaoPaulo,
	formatSlotLabel,
	listSlotStarts,
	SLOT_MINUTES,
	weekStartDateKey,
} from '@/lib/appointments/slots'
import { cn } from '@/lib/utils'

type CalendarOrder = {
	id: string
	displayNumber: number | null
	model: string
	customerName: string
	reviewed: boolean
	startsAt: string
}

const WEEKDAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const GRID_START_MIN = 8 * 60
const GRID_END_MIN = 19 * 60
const HOUR_PX = 56
const GRID_HEIGHT = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_PX
const HOURS = Array.from({ length: ((GRID_END_MIN - GRID_START_MIN) / 60) + 1 }, (_, index) => GRID_START_MIN + index * 60)

function todayKey () {
	return formatDateKeySaoPaulo(new Date())
}

function minutesInSaoPaulo (iso: string) {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: APPOINTMENT_TIME_ZONE,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(new Date(iso))
	const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
	const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
	return hour * 60 + minute
}

function dateKeyInSaoPaulo (iso: string) {
	return formatDateKeySaoPaulo(new Date(iso))
}

function hourLabel (minuteOfDay: number) {
	const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0')
	return `${hh}:00`
}

function weekTitle (startKey: string) {
	const endKey = addDateKeyDays(startKey, 6)
	const start = new Date(`${startKey}T12:00:00-03:00`)
	const end = new Date(`${endKey}T12:00:00-03:00`)
	const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: APPOINTMENT_TIME_ZONE })
	const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: APPOINTMENT_TIME_ZONE })
	const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric', timeZone: APPOINTMENT_TIME_ZONE })
	if (startKey.slice(0, 7) === endKey.slice(0, 7)) {
		return `${day.format(start)} a ${day.format(end)} de ${month.format(start)} de ${year.format(start)}`
	}
	const full = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: APPOINTMENT_TIME_ZONE })
	return `${full.format(start)} a ${full.format(end)} de ${year.format(end)}`
}

function dayNumber (dateKey: string) {
	return Number(dateKey.slice(8, 10))
}

export function AppointmentCalendarDialog () {
	const [open, setOpen] = useState(false)
	const [anchor, setAnchor] = useState(todayKey)
	const [orders, setOrders] = useState<CalendarOrder[]>([])
	const [blocks, setBlocks] = useState<string[]>([])
	const [lockMode, setLockMode] = useState(false)
	const [isLocking, setIsLocking] = useState(false)
	const [lockError, setLockError] = useState('')
	const [loading, setLoading] = useState(false)
	const [now, setNow] = useState(() => new Date())
	const scrollRef = useRef<HTMLDivElement>(null)
	const weekStart = weekStartDateKey(anchor)
	const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDateKeyDays(weekStart, index)), [weekStart])
	const today = formatDateKeySaoPaulo(now)

	async function load (startKey: string) {
		setLoading(true)
		try {
			const endKey = addDateKeyDays(startKey, 6)
			const response = await fetch(`/api/portal/agendamentos?from=${encodeURIComponent(startKey)}&to=${encodeURIComponent(endKey)}`)
			const payload = await response.json() as { orders?: CalendarOrder[], blocks?: string[] }
			setOrders(payload.orders ?? [])
			setBlocks(payload.blocks ?? [])
		} catch {
			setOrders([])
			setBlocks([])
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (!open) return
		const timer = window.setInterval(() => setNow(new Date()), 60_000)
		return () => window.clearInterval(timer)
	}, [open])

	useEffect(() => {
		const node = scrollRef.current
		if (!open || !node || loading) return
		const starts = orders.map((order) => minutesInSaoPaulo(order.startsAt)).filter((minute) => minute >= GRID_START_MIN)
		const currentMinute = minutesInSaoPaulo(new Date().toISOString())
		const target = starts.length ? Math.min(...starts) : currentMinute
		const top = Math.max(0, ((target - GRID_START_MIN) / 60) * HOUR_PX - 12)
		window.requestAnimationFrame(() => {
			node.scrollTop = top
		})
	}, [open, loading, weekStart, orders])

	async function toggleBlock (startsAt: string) {
		if (isLocking) return
		setIsLocking(true)
		setLockError('')
		try {
			const response = await fetch('/api/portal/agendamentos/bloqueios', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ startsAt }),
			})
			const payload = await response.json() as { ok?: boolean, blocked?: boolean, startsAt?: string, error?: string }
			if (!response.ok || !payload.ok || !payload.startsAt) {
				setLockError(payload.error === 'ocupado'
					? 'Esse horário já tem uma OS.'
					: 'Não foi possível travar o horário.')
				return
			}
			const instant = payload.startsAt
			setBlocks((current) => payload.blocked
				? [...current.filter((item) => item !== instant), instant]
				: current.filter((item) => item !== instant))
		} catch {
			setLockError('Não foi possível travar o horário.')
		} finally {
			setIsLocking(false)
		}
	}

	function onColumnClick (dateKey: string, event: React.MouseEvent<HTMLDivElement>) {
		if (!lockMode || isLocking) return
		const target = event.target as HTMLElement
		if (target.closest('a,button')) return
		const rect = event.currentTarget.getBoundingClientRect()
		const raw = GRID_START_MIN + ((event.clientY - rect.top) / HOUR_PX) * 60
		const snapped = Math.floor(raw / SLOT_MINUTES) * SLOT_MINUTES
		const iso = listSlotStarts(dateKey).find((item) => minutesInSaoPaulo(item) === snapped)
		if (!iso) return
		const occupied = orders.some((order) => appointmentInstantKey(order.startsAt) === iso)
		if (occupied) return
		void toggleBlock(iso)
	}

	const nowMinute = minutesInSaoPaulo(now.toISOString())
	const showNow = days.includes(today) && nowMinute >= GRID_START_MIN && nowMinute < GRID_END_MIN
	const nowTop = ((nowMinute - GRID_START_MIN) / 60) * HOUR_PX

	return (
		<Dialog open={open} onOpenChange={(next) => {
			setOpen(next)
			if (next) void load(weekStartDateKey(anchor))
		}}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto">
					<Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
					Calendário
				</Button>
			</DialogTrigger>
			<DialogContent className="flex h-[min(90dvh,840px)] max-h-[90dvh] w-[min(100%-1rem,72rem)] max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:max-w-5xl sm:p-5">
				<DialogHeader className="space-y-0 pr-8">
					<div className="flex flex-wrap items-center gap-2">
						<DialogTitle className="sr-only">Calendário de agendamentos</DialogTitle>
						<Button type="button" variant="outline" size="sm" onClick={() => {
							const next = todayKey()
							setAnchor(next)
							void load(weekStartDateKey(next))
						}}>
							Hoje
						</Button>
						<Button type="button" variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => {
							const next = addDateKeyDays(anchor, -7)
							setAnchor(next)
							void load(weekStartDateKey(next))
						}}>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button type="button" variant="ghost" size="icon" aria-label="Próxima semana" onClick={() => {
							const next = addDateKeyDays(anchor, 7)
							setAnchor(next)
							void load(weekStartDateKey(next))
						}}>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<p className="text-sm font-semibold">{weekTitle(weekStart)}</p>
						<Button
							type="button"
							variant={lockMode ? 'default' : 'outline'}
							size="sm"
							aria-pressed={lockMode}
							onClick={() => {
								setLockMode((current) => !current)
								setLockError('')
							}}
						>
							<Lock className="mr-2 h-4 w-4" aria-hidden="true" />
							{lockMode ? 'Concluir' : 'Travar horários'}
						</Button>
						{loading ? <p className="text-xs text-muted-foreground">Carregando.</p> : null}
					</div>
					{lockMode ? (
						<p className="pt-2 text-xs text-muted-foreground">
							Clique num horário livre para travar. O cliente não consegue marcar esse horário. Clique de novo no horário travado para liberar.
						</p>
					) : null}
					{lockError ? <p className="pt-2 text-xs text-destructive">{lockError}</p> : null}
				</DialogHeader>
				<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto rounded-lg border">
					<div className="min-w-[760px]">
						<div className="sticky top-0 z-20 grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b bg-background">
							<div />
							{days.map((dateKey, index) => {
								const isToday = dateKey === today
								return (
									<div key={dateKey} className="px-1 py-2 text-center">
										<p className="text-[11px] font-medium tracking-wide text-muted-foreground">{WEEKDAY_LABELS[index]}</p>
										<p className={cn(
											'mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
											isToday ? 'bg-blue-600 text-white' : 'text-foreground',
										)}>
											{dayNumber(dateKey)}
										</p>
									</div>
								)
							})}
						</div>
						<div
							className="relative grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
							style={{
								height: GRID_HEIGHT,
								backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), hsl(var(--border)) calc(100% - 1px))',
								backgroundSize: `100% ${HOUR_PX}px`,
							}}
						>
							<div className="relative">
								{HOURS.map((minute) => {
									const isFirst = minute === GRID_START_MIN
									const isLast = minute === GRID_END_MIN
									return (
										<span
											key={minute}
											className={cn(
												'absolute right-1 text-[11px] text-muted-foreground',
												isFirst ? 'top-1' : isLast ? 'bottom-1' : '-translate-y-1/2',
											)}
											style={isFirst || isLast ? undefined : { top: ((minute - GRID_START_MIN) / 60) * HOUR_PX }}
										>
											{hourLabel(minute)}
										</span>
									)
								})}
							</div>
							{days.map((dateKey) => {
								const dayOrders = orders.filter((order) => dateKeyInSaoPaulo(order.startsAt) === dateKey)
								const dayBlocks = blocks.filter((iso) => {
									if (dateKeyInSaoPaulo(iso) !== dateKey) return false
									return !dayOrders.some((order) => appointmentInstantKey(order.startsAt) === appointmentInstantKey(iso))
								})
								const isToday = dateKey === today
								return (
									<div
										key={dateKey}
										className={cn('relative border-l', isToday && 'bg-blue-50/60', lockMode && 'cursor-cell')}
										onClick={(event) => onColumnClick(dateKey, event)}
									>
										{dayBlocks.map((iso) => {
											const startMin = minutesInSaoPaulo(iso)
											const top = ((startMin - GRID_START_MIN) / 60) * HOUR_PX
											const height = Math.max((SLOT_MINUTES / 60) * HOUR_PX - 3, 22)
											return (
												<button
													key={iso}
													type="button"
													disabled={!lockMode || isLocking}
													title={`Travado · ${formatSlotLabel(iso)}`}
													onClick={() => { void toggleBlock(iso) }}
													className="absolute left-1 right-1 flex items-center overflow-hidden rounded-md bg-zinc-200 px-1.5 text-xs font-semibold text-zinc-700 disabled:cursor-default"
													style={{ top: top + 1, height }}
												>
													Travado
												</button>
											)
										})}
										{dayOrders.map((order) => {
											const startMin = minutesInSaoPaulo(order.startsAt)
											const peers = dayOrders.filter((item) => minutesInSaoPaulo(item.startsAt) === startMin)
											const index = Math.max(0, peers.findIndex((item) => item.id === order.id))
											const top = ((startMin - GRID_START_MIN) / 60) * HOUR_PX
											const height = Math.max((SLOT_MINUTES / 60) * HOUR_PX - 3, 22)
											const label = order.displayNumber != null ? `#${order.displayNumber}` : 'OS'
											return (
												<Link
													key={order.id}
													href={getOrdemPortalPath({ id: order.id, display_number: order.displayNumber })}
													title={`${label} · ${formatSlotLabel(order.startsAt)} · ${order.customerName}`}
													className={cn(
														'absolute flex items-center overflow-hidden rounded-md px-1.5 text-xs font-semibold leading-none',
														isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-100 text-blue-900 hover:bg-blue-200',
													)}
													style={{
														top: top + 1,
														height,
														left: `calc(${(100 / peers.length) * index}% + 4px)`,
														width: `calc(${100 / peers.length}% - 8px)`,
													}}
												>
													{label}
												</Link>
											)
										})}
									</div>
								)
							})}
							{showNow ? (
								<div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: nowTop }}>
									<span className="absolute left-[3.25rem] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
									<span className="absolute left-[3.25rem] right-0 h-px bg-red-500" />
								</div>
							) : null}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
