'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BOOKING_DISCOUNT_PERCENT, discountedPriceCents } from '@/lib/appointments/battery-prices'
import { trackAgendamentoConcluido, trackBookingFunnel } from '@/lib/analytics/loja-conversions'
import { formatSlotLabel, lastBookableDateKey, listSlotStarts } from '@/lib/appointments/slots'
import { whatsappLink } from '@/lib/data/hotsite-loja'
import { formatCpf } from '@/lib/utils/format-cpf-cnpj'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { isEmailFormat, isValidCpf, onlyDigits } from '@/lib/utils/strings'
import { LojaWhatsAppLink } from '../LojaWhatsAppLink'
import { WhatsAppIcon } from '../WhatsAppIcon'
import styles from '../loja.module.css'

export type BatteryAppointmentSession = {
	id: string
	displayNumber: number | null
	model: string
	startsAt: string
	when: string
	shareToken: string
	canChange: boolean
}

type Slot = { startsAt: string, label: string }
type Panel = 'book' | 'edit' | 'cancel' | 'success' | 'cancelled'

type ExistingAppointment = {
	displayNumber: number | null
	title: string
	model: string
	when: string
}

type ExtraGate = {
	kind: 'confirm' | 'limit'
	appointments: ExistingAppointment[]
}

type Props = {
	models: readonly string[]
	prices: Record<string, number>
	whatsappHref: string
	loggedIn: boolean
	appointment: BatteryAppointmentSession | null
	children: ReactNode
}

function formatMoneyBr (cents: number) {
	return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type BookingContextValue = {
	openBooking: () => void
	whatsappHref: string
}

const BookingContext = createContext<BookingContextValue | null>(null)
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type BookingValues = {
	model: string
	startsAt: string
	fullName: string
	phone: string
	email: string
	cpf: string
	companyWebsite: string
}

function maskEmail (value: string) {
	return value.replace(/\s/g, '').toLowerCase().slice(0, 160)
}

function maskPhoneInput (previous: string, nextRaw: string, cursor: number) {
	const prevDigits = onlyDigits(previous)
	let nextDigits = onlyDigits(nextRaw)
	if (nextDigits === prevDigits && nextRaw.length < previous.length) {
		const digitsBeforeCursor = onlyDigits(nextRaw.slice(0, cursor)).length
		const dropAt = Math.max(0, digitsBeforeCursor - 1)
		nextDigits = prevDigits.slice(0, dropAt) + prevDigits.slice(dropAt + 1)
	}
	return formatPhoneBr(nextDigits) || ''
}

function bookingSchema (models: readonly string[]) {
	return Yup.object({
		model: Yup.string().required('Escolha o modelo.').oneOf([...models], 'Escolha o modelo.'),
		startsAt: Yup.string().required('Escolha um horário.'),
		fullName: Yup.string().trim().required('Informe o nome.').min(3, 'Informe o nome completo.').max(120, 'Nome muito longo.'),
		phone: Yup.string().required('Informe o celular.').test('phone', 'Informe o celular com DDD.', (value) => {
			const digits = onlyDigits(value || '')
			return digits.length === 10 || digits.length === 11
		}),
		email: Yup.string().trim().required('Informe o e-mail.').test('email-format', 'E-mail inválido.', (value) => isEmailFormat(value || '')),
		cpf: Yup.string().required('Informe o CPF.').test('cpf-format', 'CPF inválido.', (value) => isValidCpf(value || '')),
		companyWebsite: Yup.string(),
	})
}

const BOOKING_STEPS = [
	'Selecione o modelo',
	'Selecione a data',
	'Selecione o horário',
	'Informe os dados',
] as const

const ERRORS: Record<string, string> = {
	dados_invalidos: 'Confira nome, e-mail, celular, CPF, modelo e horário.',
	horario_indisponivel: 'Esse horário acabou de ser ocupado. Escolha outro.',
	limite: 'Você já tem 3 agendamentos. Para criar outro, fale pelo WhatsApp.',
	limite_ip: 'Este endereço já fez 3 agendamentos hoje. Para marcar outro, fale pelo WhatsApp.',
	ja_agendado: 'Você já tem um agendamento marcado. Confirme se quer criar outro.',
	nao_editavel: 'Esse agendamento não pode mais ser alterado. A equipe já revisou ou falta menos de 1 hora.',
	nao_encontrado: 'Não encontramos um agendamento aberto nesta conta.',
	config: 'Não foi possível concluir. Tente de novo em instantes.',
}

function todayKey () {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date())
}

function addDays (dateKey: string, days: number) {
	const [year, month, day] = dateKey.split('-').map(Number)
	const date = new Date(Date.UTC(year, month - 1, day + days))
	return date.toISOString().slice(0, 10)
}

function nextOpenDate (from = todayKey()) {
	let cursor = from
	for (let index = 0; index < 21; index += 1) {
		if (listSlotStarts(cursor).length > 0) return cursor
		cursor = addDays(cursor, 1)
	}
	return from
}

function formatBookingDate (dateKey: string) {
	const [year, month, day] = dateKey.split('-').map(Number)
	return new Intl.DateTimeFormat('pt-BR', {
		day: 'numeric',
		month: 'long',
	}).format(new Date(year, month - 1, day))
}

function monthLabel (year: number, month: number) {
	return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
}

function dayNumber (dateKey: string) {
	return Number(dateKey.slice(8, 10))
}

function loginHref () {
	return `/portal/login?redirectTo=${encodeURIComponent('/loja/bateria-iphone#agendamento')}`
}

function useBatteryBooking () {
	const value = useContext(BookingContext)
	if (!value) {
		throw new Error('Agendamento fora do contexto da landing.')
	}
	return value
}

export function BatteryBookingTrigger () {
	const { openBooking } = useBatteryBooking()
	return (
		<button type="button" className={`${styles.ctaNeon} ${styles.heroBook}`} onClick={openBooking}>
			Agendar troca
			<span className={styles.heroBookOff}>5% de desconto</span>
		</button>
	)
}

export function BatteryBookingBand () {
	const { openBooking } = useBatteryBooking()
	return (
		<section id="agendamento" className={styles.booking} aria-labelledby="agendamento-titulo">
			<div className={styles.bookingCard}>
				<p className={styles.bookingKicker}>Exclusivo para agendamento online</p>
				<h2 id="agendamento-titulo">Agendar troca</h2>
				<p className={styles.bookingOff}>
					<strong>5%</strong>
					<span>off</span>
				</p>
				<p className={styles.bookingLead}>
					O desconto entra automaticamente na ordem de serviço, à vista ou parcelado.
				</p>
				<button type="button" className={styles.ctaNeon} onClick={openBooking}>
					Agendar com 5% off
				</button>
			</div>
		</section>
	)
}

function CalendarPicker ({
	date,
	onDate,
	openDates,
}: {
	date: string
	onDate: (dateKey: string) => void
	openDates: ReadonlySet<string> | null
}) {
	const today = todayKey()
	const latest = lastBookableDateKey()
	const [cursor, setCursor] = useState(() => date.slice(0, 7))
	const [year, month] = cursor.split('-').map(Number)
	const firstWeekday = new Date(year, month - 1, 1).getDay()
	const mondayOffset = (firstWeekday + 6) % 7
	const daysInMonth = new Date(year, month, 0).getDate()
	const cells = useMemo(() => {
		const next: Array<string | null> = Array.from({ length: mondayOffset }, () => null)
		for (let day = 1; day <= daysInMonth; day += 1) {
			next.push(`${cursor}-${String(day).padStart(2, '0')}`)
		}
		return next
	}, [cursor, daysInMonth, mondayOffset])
	const currentMonth = today.slice(0, 7)
	const nextMonthStart = month === 12
		? `${year + 1}-01-01`
		: `${year}-${String(month + 1).padStart(2, '0')}-01`

	return (
		<div className={styles.calendar}>
			<div className={styles.calendarHead}>
				<button
					type="button"
					className={styles.calendarNav}
					onClick={() => {
						const previous = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
						setCursor(previous)
					}}
					disabled={cursor <= currentMonth}
				>
					Mês anterior
				</button>
				<strong>{monthLabel(year, month - 1)}</strong>
				<button
					type="button"
					className={styles.calendarNav}
					onClick={() => {
						const following = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
						setCursor(following)
					}}
					disabled={nextMonthStart > latest}
				>
					Próximo mês
				</button>
			</div>
			<div className={styles.calendarWeek}>
				{WEEKDAYS.map((label) => <span key={label}>{label}</span>)}
			</div>
			<TooltipProvider delayDuration={200}>
				<div className={styles.calendarGrid} role="grid">
					{cells.map((dateKey, index) => {
						if (!dateKey) return <span key={`empty-${index}`} />
						const outside = dateKey < today || dateKey > latest || listSlotStarts(dateKey).length === 0
						const full = !outside && openDates !== null && !openDates.has(dateKey)
						if (!full) {
							return (
								<button
									key={dateKey}
									type="button"
									className={styles.calendarDay}
									disabled={outside}
									aria-pressed={date === dateKey}
									onClick={() => onDate(dateKey)}
								>
									{dayNumber(dateKey)}
								</button>
							)
						}
						return (
							<Tooltip key={dateKey}>
								<TooltipTrigger asChild>
									<button
										type="button"
										className={styles.calendarDay}
										aria-disabled="true"
										aria-pressed="false"
										aria-label={`${dayNumber(dateKey)}. Não há horários disponíveis`}
										onClick={(event) => event.preventDefault()}
									>
										{dayNumber(dateKey)}
									</button>
								</TooltipTrigger>
								<TooltipContent side="top" className="z-[90] border-0 bg-[#0a0a0a] px-2.5 py-1.5 text-xs font-medium text-white">
									Não há horários disponíveis
								</TooltipContent>
							</Tooltip>
						)
					})}
				</div>
			</TooltipProvider>
		</div>
	)
}

export function BatteryBooking ({ models, prices, whatsappHref, loggedIn, appointment, children }: Props) {
	const [open, setOpen] = useState(false)
	const [panel, setPanel] = useState<Panel>('book')
	const [date, setDate] = useState(nextOpenDate)
	const [openDates, setOpenDates] = useState<string[] | null>(null)
	const [slots, setSlots] = useState<Slot[]>([])
	const [slotsLoading, setSlotsLoading] = useState(false)
	const [startsAt, setStartsAt] = useState('')
	const [error, setError] = useState('')
	const [pending, setPending] = useState(false)
	const [created, setCreated] = useState<{ displayNumber: number | null, shareToken: string } | null>(null)
	const [extraGate, setExtraGate] = useState<ExtraGate | null>(null)
	const [step, setStep] = useState(0)
	const submitLockRef = useRef(false)
	const schema = useMemo(() => bookingSchema(models), [models])
	const formik = useFormik<BookingValues>({
		initialValues: {
			model: models[0] || '',
			startsAt: '',
			fullName: '',
			phone: '',
			email: '',
			cpf: '',
			companyWebsite: '',
		},
		validationSchema: schema,
		onSubmit: (values) => submitNew(values),
	})

	useEffect(() => {
		trackBookingFunnel('view_offer')
	}, [])

	const openDateSet = useMemo(() => (openDates ? new Set(openDates) : null), [openDates])
	const dateRef = useRef(date)
	dateRef.current = date

	useEffect(() => {
		if (!open || (panel !== 'book' && panel !== 'edit')) return
		const controller = new AbortController()
		fetch('/api/loja/bateria/horarios?disponiveis=1', { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) return null
				return response.json() as Promise<{ dates?: string[] }>
			})
			.then((payload) => {
				if (!payload) return
				const dates = payload.dates ?? []
				setOpenDates(dates)
				if (!dates.includes(dateRef.current)) {
					const next = [...dates].sort()[0]
					if (next) {
						setDate(next)
						setStartsAt('')
						void formik.setFieldValue('startsAt', '', false)
					}
				}
			})
			.catch((err: unknown) => {
				if ((err as { name?: string }).name === 'AbortError') return
				setOpenDates(null)
			})
		return () => controller.abort()
	}, [open, panel])

	useEffect(() => {
		if (!open || (panel !== 'book' && panel !== 'edit')) return
		const controller = new AbortController()
		setSlotsLoading(true)
		setStartsAt('')
		void formik.setFieldValue('startsAt', '', false)
		fetch(`/api/loja/bateria/horarios?date=${encodeURIComponent(date)}`, { signal: controller.signal })
			.then(async (response) => response.json() as Promise<{ slots?: Slot[] }>)
			.then((payload) => setSlots(payload.slots ?? []))
			.catch((err: unknown) => {
				if ((err as { name?: string }).name === 'AbortError') return
				setSlots([])
			})
			.finally(() => setSlotsLoading(false))
		return () => controller.abort()
	}, [date, open, panel])

	function openBooking () {
		setError('')
		setStep(0)
		setPanel('book')
		setOpen(true)
		trackBookingFunnel('start_booking')
	}

	function chooseDate (dateKey: string) {
		if (openDateSet && !openDateSet.has(dateKey)) return
		setDate(dateKey)
		setStartsAt('')
		void formik.setFieldValue('startsAt', '', false)
	}

	function funnelDetail (extra?: { error?: string, slot?: string }) {
		return {
			model: formik.values.model,
			date,
			slot: extra?.slot || formik.values.startsAt,
			error: extra?.error,
		}
	}

	function chooseSlot (slot: Slot) {
		setStartsAt(slot.startsAt)
		void formik.setFieldValue('startsAt', slot.startsAt)
		trackBookingFunnel('select_slot', funnelDetail({ slot: slot.startsAt }))
	}

	async function submitNew (values: BookingValues, confirmExtra = false) {
		if (submitLockRef.current) return
		submitLockRef.current = true
		const email = values.email.trim()
		const emailOk = isEmailFormat(email)
		const cpfOk = isValidCpf(values.cpf)
		if (!emailOk || !cpfOk) {
			if (!emailOk) {
				formik.setFieldError('email', 'E-mail inválido.')
				void formik.setFieldTouched('email', true, false)
			}
			if (!cpfOk) {
				formik.setFieldError('cpf', 'CPF inválido.')
				void formik.setFieldTouched('cpf', true, false)
			}
			trackBookingFunnel('booking_error', funnelDetail({ error: 'dados_invalidos' }))
			submitLockRef.current = false
			return
		}
		setError('')
		if (!confirmExtra) setExtraGate(null)
		setPending(true)
		trackBookingFunnel('submit_attempt', funnelDetail())
		try {
			const response = await fetch('/api/loja/bateria/agendamentos', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					model: values.model,
					startsAt: values.startsAt,
					fullName: values.fullName.trim(),
					email: values.email.trim(),
					phone: values.phone,
					cpf: values.cpf,
					companyWebsite: values.companyWebsite,
					confirmExtra,
					visit: {
						path: window.location.pathname,
						search: window.location.search,
						referrer: document.referrer,
					},
				}),
			})
			const payload = await response.json() as {
				ok?: boolean
				error?: string
				displayNumber?: number | null
				shareToken?: string
				appointments?: ExistingAppointment[]
			}
			if (!response.ok || !payload.ok) {
				const appointments = payload.appointments ?? []
				if (payload.error === 'ja_agendado' && appointments.length) {
					trackBookingFunnel('booking_extra_prompt', funnelDetail())
					setExtraGate({ kind: 'confirm', appointments })
					return
				}
				if (payload.error === 'limite' || payload.error === 'limite_ip') {
					trackBookingFunnel('booking_blocked', funnelDetail({ error: payload.error }))
					if (payload.error === 'limite') setExtraGate({ kind: 'limit', appointments })
					setError(ERRORS[payload.error] || ERRORS.config)
					return
				}
				trackBookingFunnel('booking_error', funnelDetail({ error: payload.error || 'config' }))
				setError(ERRORS[payload.error || ''] || ERRORS.config)
				return
			}
			trackBookingFunnel('submit_booking', funnelDetail())
			const horario = slots.find((slot) => slot.startsAt === values.startsAt)?.label || formatSlotLabel(values.startsAt)
			trackAgendamentoConcluido({
				modelo: values.model,
				dataAgendada: date,
				horario,
			})
			setCreated({
				displayNumber: payload.displayNumber ?? null,
				shareToken: payload.shareToken || '',
			})
			setPanel('success')
		} catch {
			trackBookingFunnel('booking_error', funnelDetail({ error: 'config' }))
			setError(ERRORS.config)
		} finally {
			submitLockRef.current = false
			setPending(false)
		}
	}

	async function submitEdit (event: FormEvent) {
		event.preventDefault()
		setError('')
		setPending(true)
		try {
			const response = await fetch('/api/loja/bateria/agendamentos', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ startsAt }),
			})
			const payload = await response.json() as { ok?: boolean, error?: string }
			if (!response.ok || !payload.ok) {
				setError(ERRORS[payload.error || ''] || ERRORS.config)
				return
			}
			window.location.assign('/loja/bateria-iphone#agendamento')
		} catch {
			setError(ERRORS.config)
		} finally {
			setPending(false)
		}
	}

	async function submitCancel () {
		setError('')
		setPending(true)
		try {
			const response = await fetch('/api/loja/bateria/agendamentos', { method: 'DELETE' })
			const payload = await response.json() as { ok?: boolean, error?: string }
			if (!response.ok || !payload.ok) {
				setError(ERRORS[payload.error || ''] || ERRORS.config)
				return
			}
			setPanel('cancelled')
		} catch {
			setError(ERRORS.config)
		} finally {
			setPending(false)
		}
	}

	const accountHref = created?.shareToken ? '/portal/cadastro?origem=agendamento' : ''
	const selectedLabel = slots.find((slot) => slot.startsAt === formik.values.startsAt)?.label || ''
	const [bookingYear, bookingMonth, bookingDay] = date.split('-')
	const whatsappChangeHref = whatsappLink(
		[
			'Olá! Acabei de agendar a troca de bateria pelo site e quero alterar o horário.',
			created?.displayNumber != null ? `OS #${created.displayNumber}` : '',
			`Modelo: ${formik.values.model}`,
			`Data: ${bookingDay}/${bookingMonth}/${bookingYear}${selectedLabel ? `, às ${selectedLabel}` : ''}`,
			`Nome: ${formik.values.fullName}`,
		].filter(Boolean).join('\n'),
	)
	const maintenanceCents = prices[formik.values.model] || 0
	const whatsappExistingHref = whatsappLink(
		[
			extraGate?.kind === 'limit'
				? 'Olá! Já tenho 3 agendamentos de troca de bateria e quero marcar outro.'
				: 'Olá! Já tenho um agendamento de troca de bateria e quero alterar.',
			...(extraGate?.appointments ?? []).map((item) => [
				item.displayNumber != null ? `OS #${item.displayNumber}` : '',
				item.title,
				item.model ? `Modelo: ${item.model}` : '',
				item.when ? `Horário: ${item.when}` : '',
			].filter(Boolean).join(', ')),
		].filter(Boolean).join('\n'),
	)
	const whatsappRequestHref = whatsappLink(
		[
			`Olá, vim pelo site! Gostaria de agendar a troca de bateria do ${formik.values.model}, dia ${bookingDay}/${bookingMonth}/${bookingYear}${selectedLabel ? `, às ${selectedLabel}` : ''}.`,
			'',
			`Nome: ${formik.values.fullName}`,
			`Celular: ${formik.values.phone}`,
			`E-mail: ${formik.values.email}`,
			`CPF: ${formik.values.cpf}`,
		].join('\n'),
	)

	function fieldMessage (field: keyof BookingValues) {
		const message = formik.errors[field]
		if (typeof message !== 'string' || !message) return ''
		if (!formik.touched[field] && formik.submitCount === 0) return ''
		return message
	}

	const canContinue = step === 0
		? Boolean(formik.values.model)
		: step === 1
			? Boolean(openDateSet?.has(date))
			: step === 2
				? Boolean(formik.values.startsAt)
				: true

	function goNext () {
		if (step === 0) trackBookingFunnel('select_model', { model: formik.values.model })
		if (step === 1) trackBookingFunnel('select_date', { model: formik.values.model, date })
		setStep((current) => Math.min(current + 1, BOOKING_STEPS.length - 1))
	}

	function goBack () {
		setExtraGate(null)
		setStep((current) => Math.max(current - 1, 0))
	}

	const schedule = (
		<>
			<CalendarPicker date={date} onDate={chooseDate} openDates={openDateSet} />
			<div>
				<p className={styles.bookingNote}>Horários livres neste dia</p>
				<div className={styles.bookingSlots}>
					{slotsLoading ? <span className={styles.bookingNote}>Carregando horários.</span> : null}
					{!slotsLoading && slots.length === 0 ? <span className={styles.bookingNote}>Nenhum horário neste dia.</span> : null}
					{slots.map((slot) => (
						<button
							key={slot.startsAt}
							type="button"
							className={styles.bookingSlot}
							aria-pressed={startsAt === slot.startsAt}
							onClick={() => chooseSlot(slot)}
						>
							{slot.label}
						</button>
					))}
				</div>
			</div>
		</>
	)

	return (
		<BookingContext.Provider value={{ openBooking, whatsappHref }}>
			{children}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className={styles.bookingDialog}>
					<DialogHeader className={styles.bookingDialogHead}>
						<DialogTitle className={styles.bookingDialogTitle}>
							{panel === 'success' ? 'Agendamento Realizado!' : 'Agendar com 5% de desconto'}
						</DialogTitle>
						<DialogDescription className={styles.bookingDialogHidden}>
							{panel === 'success' ? 'Seu agendamento foi confirmado.' : BOOKING_STEPS[step]}
						</DialogDescription>
					</DialogHeader>

					{panel === 'book' ? (
						<form className={styles.bookingForm} onSubmit={formik.handleSubmit} noValidate>
							<ol className={styles.bookingSteps} aria-label="Etapas do agendamento">
								{BOOKING_STEPS.map((label, index) => (
									<li
										key={label}
										className={styles.bookingStep}
										aria-current={index === step ? 'step' : undefined}
										data-done={index < step ? 'true' : undefined}
									>
										<span className={styles.bookingStepLabel}>{label}</span>
									</li>
								))}
							</ol>
							<h3 className={styles.bookingStepTitle}>{BOOKING_STEPS[step]}</h3>

							{step === 0 ? (
								<div className={styles.bookingModels} role="group" aria-label="Modelo">
									{models.map((item) => (
										<button
											key={item}
											type="button"
											className={styles.bookingSlot}
											aria-pressed={formik.values.model === item}
											onClick={() => { void formik.setFieldValue('model', item) }}
										>
											{item}
										</button>
									))}
								</div>
							) : null}

							{step === 1 ? <CalendarPicker date={date} onDate={chooseDate} openDates={openDateSet} /> : null}

							{step === 2 ? (
								<div>
									<p className={styles.bookingNote}>{formatBookingDate(date)}</p>
									<div className={styles.bookingSlots}>
										{slotsLoading ? <span className={styles.bookingNote}>Carregando horários.</span> : null}
										{!slotsLoading && slots.length === 0 ? <span className={styles.bookingNote}>Nenhum horário neste dia.</span> : null}
										{slots.map((slot) => (
											<button
												key={slot.startsAt}
												type="button"
												className={styles.bookingSlot}
												aria-pressed={formik.values.startsAt === slot.startsAt}
												onClick={() => chooseSlot(slot)}
											>
												{slot.label}
											</button>
										))}
									</div>
								</div>
							) : null}

							{step === 3 ? (
								<>
									<div className={styles.bookingSummary}>
										<dl className={styles.bookingPicks}>
											<div className={styles.bookingPick}>
												<dt>Modelo</dt>
												<dd>{formik.values.model}</dd>
											</div>
											<div className={styles.bookingPick}>
												<dt>Data</dt>
												<dd>{formatBookingDate(date)}</dd>
											</div>
											<div className={styles.bookingPick}>
												<dt>Horário</dt>
												<dd>{selectedLabel || 'A escolher'}</dd>
											</div>
										</dl>
										{prices[formik.values.model] > 0 ? (
											<p className={styles.bookingPrice}>
												<span className={styles.bookingPriceLabel}>Manutenção</span>
												<s className={styles.bookingPriceWas}>{formatMoneyBr(prices[formik.values.model])}</s>
												<strong className={styles.bookingPriceNow}>{formatMoneyBr(discountedPriceCents(prices[formik.values.model]))}</strong>
												<em className={styles.bookingPriceOff}>{BOOKING_DISCOUNT_PERCENT}% off</em>
											</p>
										) : null}
									</div>
									<div className={styles.bookingFields}>
										<label className={styles.bookingField}>
											Nome
											<input
												name="fullName"
												value={formik.values.fullName}
												onChange={formik.handleChange}
												onBlur={formik.handleBlur}
												autoComplete="name"
												aria-invalid={Boolean(fieldMessage('fullName'))}
											/>
											{fieldMessage('fullName') ? <span className={styles.bookingFieldError}>{fieldMessage('fullName')}</span> : null}
										</label>
										<label className={styles.bookingField}>
											Celular
											<input
												name="phone"
												value={formik.values.phone}
												onChange={(event) => {
													const input = event.target
													void formik.setFieldValue('phone', maskPhoneInput(formik.values.phone, input.value, input.selectionStart ?? input.value.length))
												}}
												onBlur={formik.handleBlur}
												inputMode="tel"
												autoComplete="tel"
												placeholder="(31) 9 0000-0000"
												aria-invalid={Boolean(fieldMessage('phone'))}
											/>
											{fieldMessage('phone') ? <span className={styles.bookingFieldError}>{fieldMessage('phone')}</span> : null}
										</label>
										<label className={styles.bookingField}>
											E-mail
											<input
												name="email"
												type="email"
												value={formik.values.email}
												onChange={(event) => { void formik.setFieldValue('email', maskEmail(event.target.value)) }}
												onBlur={formik.handleBlur}
												inputMode="email"
												autoComplete="email"
												placeholder="nome@email.com"
												aria-invalid={Boolean(fieldMessage('email'))}
											/>
											{fieldMessage('email') ? <span className={styles.bookingFieldError}>{fieldMessage('email')}</span> : null}
										</label>
										<label className={styles.bookingField}>
											CPF
											<input
												name="cpf"
												value={formik.values.cpf}
												onChange={(event) => { void formik.setFieldValue('cpf', formatCpf(event.target.value)) }}
												onBlur={formik.handleBlur}
												inputMode="numeric"
												autoComplete="off"
												placeholder="000.000.000-00"
												aria-invalid={Boolean(fieldMessage('cpf'))}
											/>
											{fieldMessage('cpf') ? <span className={styles.bookingFieldError}>{fieldMessage('cpf')}</span> : null}
										</label>
									</div>
								</>
							) : null}

							<label className={styles.bookingHoneypot} aria-hidden="true">
								Site
								<input
									name="companyWebsite"
									tabIndex={-1}
									autoComplete="off"
									value={formik.values.companyWebsite}
									onChange={formik.handleChange}
								/>
							</label>
							{extraGate ? (
								<div className={styles.bookingSummary}>
									<p className={styles.bookingNote}>
										{extraGate.kind === 'limit'
											? 'Você já tem 3 agendamentos. Para criar outro, fale pelo WhatsApp.'
											: extraGate.appointments.length > 1
												? 'Você já tem agendamentos marcados. Deseja seguir com um novo? Para alterar algum deles, fale pelo WhatsApp.'
												: 'Você já tem um agendamento marcado. Deseja seguir com um novo? Para alterar o anterior, fale pelo WhatsApp.'}
									</p>
									<dl className={styles.bookingRecap}>
										{extraGate.appointments.map((item) => (
											<div key={`${item.displayNumber ?? 'os'}-${item.when}`}>
												<dt>{item.displayNumber != null ? `#${item.displayNumber}` : 'OS'}</dt>
												<dd>{[item.title, item.model, item.when].filter(Boolean).join(', ')}</dd>
											</div>
										))}
									</dl>
								</div>
							) : null}
							{error && extraGate?.kind !== 'limit' ? <p className={styles.bookingError}>{error}</p> : null}
							{step < 3 ? (
								<div className={styles.bookingNav}>
									{step > 0 ? (
										<button type="button" className={styles.ctaGhost} onClick={goBack}>Voltar</button>
									) : null}
									<button type="button" className={styles.ctaPrimary} disabled={!canContinue} onClick={goNext}>
										Continuar
									</button>
								</div>
							) : (
								<>
									<button type="button" className={styles.ctaGhost} onClick={goBack}>Voltar</button>
									<div className={styles.bookingSubmit}>
										<LojaWhatsAppLink
											className={styles.ctaWhatsapp}
											href={extraGate ? whatsappExistingHref : whatsappRequestHref}
											placement="contato"
											onClick={() => trackBookingFunnel(
												extraGate?.kind === 'limit' ? 'whatsapp_existing' : extraGate ? 'whatsapp_change' : 'whatsapp_request',
												funnelDetail(),
											)}
										>
											<WhatsAppIcon className="h-5 w-5" />
											{extraGate?.kind === 'limit' ? 'Agendar pelo WhatsApp' : extraGate ? 'Alterar pelo WhatsApp' : 'Solicitar pelo WhatsApp'}
										</LojaWhatsAppLink>
										{extraGate?.kind === 'limit' ? null : extraGate?.kind === 'confirm' ? (
											<button type="button" className={styles.ctaPrimary} disabled={pending} onClick={() => { void submitNew(formik.values, true) }}>
												{pending ? 'Agendando...' : 'Seguir com novo agendamento'}
											</button>
										) : (
											<button type="submit" className={styles.ctaPrimary} disabled={pending || formik.isSubmitting}>
												{pending ? 'Agendando...' : 'Agendar'}
											</button>
										)}
									</div>
								</>
							)}
						</form>
					) : null}

					{panel === 'edit' ? (
						loggedIn && appointment?.canChange ? (
							<form className={styles.bookingForm} onSubmit={(event) => { void submitEdit(event) }}>
								<p className={styles.bookingNote}>Horário atual: {appointment.when}. Marque o novo dia e horário.</p>
								{schedule}
								{error ? <p className={styles.bookingError}>{error}</p> : null}
								<button type="submit" className={styles.ctaPrimary} disabled={pending || !startsAt}>
									{pending ? 'Salvando...' : 'Salvar novo horário'}
								</button>
							</form>
						) : (
							<p className={styles.bookingNote}>
								{loggedIn
									? 'Não há agendamento aberto que ainda possa ser alterado.'
									: 'Entre com o e-mail e a senha criados depois do agendamento.'}
								{' '}
								{loggedIn ? null : <a href={loginHref()}>Entrar</a>}
							</p>
						)
					) : null}

					{panel === 'cancel' ? (
						loggedIn && appointment?.canChange ? (
							<div className={styles.bookingForm}>
								<p><strong>Cancelar agendamento?</strong></p>
								<p className={styles.bookingNote}>O horário fica livre e a ordem de serviço é cancelada.</p>
								{error ? <p className={styles.bookingError}>{error}</p> : null}
								<button type="button" className={styles.ctaPrimary} disabled={pending} onClick={() => { void submitCancel() }}>
									{pending ? 'Cancelando...' : 'Cancelar agendamento'}
								</button>
							</div>
						) : (
							<p className={styles.bookingNote}>
								{loggedIn
									? 'Não há agendamento aberto que ainda possa ser cancelado.'
									: 'Entre com a mesma conta do agendamento, com pelo menos 1 hora de antecedência.'}
								{' '}
								{loggedIn ? null : <a href={loginHref()}>Entrar</a>}
							</p>
						)
					) : null}

					{panel === 'success' && created ? (
						<div className={styles.bookingSuccess}>
							{created.displayNumber != null ? (
								<p className={styles.bookingOsNumber}>
									<svg className={styles.bookingOsMark} viewBox="0 0 360 108" role="img" aria-label={`Ordem de serviço #${created.displayNumber}`}>
										<defs>
											<linearGradient id="booking-os-gradient" x1="0" y1="0" x2="1" y2="1">
												<stop offset="0%" stopColor="#0c4a62" />
												<stop offset="46%" stopColor="#156787" />
												<stop offset="100%" stopColor="#0a3a4e" />
											</linearGradient>
										</defs>
										<text x="180" y="30" textAnchor="middle" fill="url(#booking-os-gradient)" fontFamily="Outfit, sans-serif" fontSize="16" fontWeight="700">
											Ordem de serviço
										</text>
										<text x="180" y="88" textAnchor="middle" fill="url(#booking-os-gradient)" fontFamily="Outfit, sans-serif" fontSize="52" fontWeight="700">
											#{created.displayNumber}
										</text>
									</svg>
								</p>
							) : null}
							<dl className={styles.bookingSuccessWhen}>
								<div>
									<dt>Modelo</dt>
									<dd>{formik.values.model}</dd>
								</div>
								<div>
									<dt>Data</dt>
									<dd>{formatBookingDate(date)}</dd>
								</div>
								<div>
									<dt>Horário</dt>
									<dd>{selectedLabel}</dd>
								</div>
							</dl>
							<dl className={styles.bookingRecap}>
								<div>
									<dt>Nome</dt>
									<dd>{formik.values.fullName}</dd>
								</div>
								<div>
									<dt>Celular</dt>
									<dd>{formik.values.phone}</dd>
								</div>
								<div>
									<dt>E-mail</dt>
									<dd>{formik.values.email}</dd>
								</div>
								<div>
									<dt>CPF</dt>
									<dd>{formik.values.cpf}</dd>
								</div>
							</dl>
							{maintenanceCents > 0 ? (
								<p className={styles.bookingPrice}>
									<span className={styles.bookingPriceLabel}>Manutenção</span>
									<span className={styles.bookingPriceValues}>
										<s className={styles.bookingPriceWas}>{formatMoneyBr(maintenanceCents)}</s>
										<strong className={styles.bookingPriceNow}>{formatMoneyBr(discountedPriceCents(maintenanceCents))}</strong>
										<em className={styles.bookingPriceOff}>{BOOKING_DISCOUNT_PERCENT}% off</em>
									</span>
								</p>
							) : null}
							<ul className={styles.bookingSuccessHints}>
								<li>Crie uma conta para acompanhar as ordens. Na primeira tela, informe o CPF deste agendamento.</li>
								<li>Para alterar ou cancelar, fale pelo WhatsApp.</li>
							</ul>
							<div className={styles.bookingSubmit}>
								{accountHref ? (
									<a className={styles.ctaPrimary} href={accountHref} onClick={() => trackBookingFunnel('account_start')}>
										Criar conta
									</a>
								) : null}
								<LojaWhatsAppLink
									className={styles.ctaWhatsapp}
									href={whatsappChangeHref}
									placement="contato"
									onClick={() => trackBookingFunnel('whatsapp_change', funnelDetail())}
								>
									<WhatsAppIcon className="h-5 w-5" />
									Alterar pelo WhatsApp
								</LojaWhatsAppLink>
							</div>
							{created.shareToken ? (
								<a className={styles.ctaGhost} href={`/os/${created.shareToken}`}>Acompanhar a OS</a>
							) : null}
						</div>
					) : null}

					{panel === 'cancelled' ? (
						<p className={styles.bookingNote}>Agendamento cancelado. O horário ficou livre.</p>
					) : null}

				</DialogContent>
			</Dialog>
		</BookingContext.Provider>
	)
}
