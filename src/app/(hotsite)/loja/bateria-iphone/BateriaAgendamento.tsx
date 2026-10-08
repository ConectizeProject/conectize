'use client'

import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { trackBookingFunnel } from '@/lib/analytics/loja-conversions'
import { lastBookableDateKey, listSlotStarts } from '@/lib/appointments/slots'
import { whatsappLink } from '@/lib/data/hotsite-loja'
import { CONECTIZE_HOST_SLUG } from '@/lib/organizations/constants'
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

type Props = {
	models: readonly string[]
	whatsappHref: string
	loggedIn: boolean
	appointment: BatteryAppointmentSession | null
	children: ReactNode
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
	limite: 'Você já fez vários agendamentos agora. Tente de novo mais tarde.',
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

function CalendarPicker ({ date, onDate }: { date: string, onDate: (dateKey: string) => void }) {
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
			<div className={styles.calendarGrid} role="grid">
				{cells.map((dateKey, index) => {
					if (!dateKey) return <span key={`empty-${index}`} />
					const closed = dateKey < today || dateKey > latest || listSlotStarts(dateKey).length === 0
					return (
						<button
							key={dateKey}
							type="button"
							className={styles.calendarDay}
							disabled={closed}
							aria-pressed={date === dateKey}
							onClick={() => onDate(dateKey)}
						>
							{dayNumber(dateKey)}
						</button>
					)
				})}
			</div>
		</div>
	)
}

export function BatteryBooking ({ models, whatsappHref, loggedIn, appointment, children }: Props) {
	const [open, setOpen] = useState(false)
	const [panel, setPanel] = useState<Panel>('book')
	const [date, setDate] = useState(nextOpenDate)
	const [slots, setSlots] = useState<Slot[]>([])
	const [slotsLoading, setSlotsLoading] = useState(false)
	const [startsAt, setStartsAt] = useState('')
	const [error, setError] = useState('')
	const [pending, setPending] = useState(false)
	const [created, setCreated] = useState<{ displayNumber: number | null, shareToken: string } | null>(null)
	const [step, setStep] = useState(0)
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
		setDate(dateKey)
		setStartsAt('')
		void formik.setFieldValue('startsAt', '', false)
	}

	function chooseSlot (slot: Slot) {
		setStartsAt(slot.startsAt)
		void formik.setFieldValue('startsAt', slot.startsAt)
		trackBookingFunnel('select_slot')
	}

	async function submitNew (values: BookingValues) {
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
			return
		}
		setError('')
		setPending(true)
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
				}),
			})
			const payload = await response.json() as { ok?: boolean, error?: string, displayNumber?: number | null, shareToken?: string }
			if (!response.ok || !payload.ok) {
				setError(ERRORS[payload.error || ''] || ERRORS.config)
				return
			}
			trackBookingFunnel('submit_booking')
			setCreated({
				displayNumber: payload.displayNumber ?? null,
				shareToken: payload.shareToken || '',
			})
			setPanel('success')
		} catch {
			setError(ERRORS.config)
		} finally {
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

	const accountHref = created?.shareToken
		? `/cadastro-cliente?org=${encodeURIComponent(CONECTIZE_HOST_SLUG)}&ref_os=${encodeURIComponent(created.shareToken)}`
		: ''
	const selectedLabel = slots.find((slot) => slot.startsAt === formik.values.startsAt)?.label || ''
	const [bookingYear, bookingMonth, bookingDay] = date.split('-')
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
		: step === 2
			? Boolean(formik.values.startsAt)
			: true

	function goNext () {
		setStep((current) => Math.min(current + 1, BOOKING_STEPS.length - 1))
	}

	function goBack () {
		setStep((current) => Math.max(current - 1, 0))
	}

	const schedule = (
		<>
			<CalendarPicker date={date} onDate={chooseDate} />
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
						<DialogTitle className={styles.bookingDialogTitle}>Agendar com 5% de desconto</DialogTitle>
						<DialogDescription className={styles.bookingDialogHidden}>
							{BOOKING_STEPS[step]}
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

							{step === 1 ? <CalendarPicker date={date} onDate={chooseDate} /> : null}

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
									<p className={styles.bookingNote}>
										{formik.values.model}, {formatBookingDate(date)}{selectedLabel ? `, às ${selectedLabel}` : ''}.
									</p>
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
							{error ? <p className={styles.bookingError}>{error}</p> : null}
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
										<LojaWhatsAppLink className={styles.ctaWhatsapp} href={whatsappRequestHref} placement="contato">
											<WhatsAppIcon className="h-5 w-5" />
											Solicitar pelo WhatsApp
										</LojaWhatsAppLink>
										<button type="submit" className={styles.ctaPrimary} disabled={pending || formik.isSubmitting}>
											{pending ? 'Agendando...' : 'Agendar'}
										</button>
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
						<div className={styles.bookingForm}>
							<p>
								<strong>Agendamento confirmado{created.displayNumber != null ? ` · OS #${created.displayNumber}` : ''}.</strong>
							</p>
							<p className={styles.bookingNote}>
								Crie uma senha com o mesmo e-mail para alterar ou cancelar depois. Sem a senha, o horário não pode ser editado.
							</p>
							{accountHref ? (
								<a className={styles.ctaPrimary} href={accountHref} onClick={() => trackBookingFunnel('account_created')}>
									Criar senha
								</a>
							) : null}
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
