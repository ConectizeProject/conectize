export const APPOINTMENT_TIME_ZONE = 'America/Sao_Paulo'
export const SLOT_MINUTES = 30
export const OPEN_BUFFER_MINUTES = 60
export const BOOKING_HORIZON_DAYS = 15
const SAO_PAULO_OFFSET = '-03:00'

const WEEKDAY_INDEX: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
}

type DayRule = {
	opens: number
	closes: number
}

/** Minutos desde meia-noite. Domingo fechado. */
const DAY_RULES: Array<DayRule | null> = [
	null,
	{ opens: 8 * 60 + 30, closes: 18 * 60 + 30 },
	{ opens: 8 * 60 + 30, closes: 18 * 60 + 30 },
	{ opens: 8 * 60 + 30, closes: 18 * 60 + 30 },
	{ opens: 8 * 60 + 30, closes: 18 * 60 + 30 },
	{ opens: 8 * 60 + 30, closes: 18 * 60 + 30 },
	{ opens: 10 * 60, closes: 14 * 60 },
]

export function isDateKey (value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function weekdayIndexInSaoPaulo (dateKey: string) {
	const date = new Date(`${dateKey}T12:00:00${SAO_PAULO_OFFSET}`)
	const label = new Intl.DateTimeFormat('en-US', {
		timeZone: APPOINTMENT_TIME_ZONE,
		weekday: 'short',
	}).format(date)
	return WEEKDAY_INDEX[label] ?? 0
}

export function addDateKeyDays (dateKey: string, days: number) {
	const [year, month, day] = dateKey.split('-').map(Number)
	const date = new Date(Date.UTC(year, month - 1, day + days))
	return date.toISOString().slice(0, 10)
}

export function lastBookableDateKey (now = new Date()) {
	return addDateKeyDays(formatDateKeySaoPaulo(now), BOOKING_HORIZON_DAYS)
}

export function formatDateKeySaoPaulo (date: Date) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: APPOINTMENT_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date)
}

export function formatSlotLabel (iso: string) {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	return new Intl.DateTimeFormat('pt-BR', {
		timeZone: APPOINTMENT_TIME_ZONE,
		hour: '2-digit',
		minute: '2-digit',
	}).format(date)
}

export function formatAppointmentWhen (iso: string) {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	const day = new Intl.DateTimeFormat('pt-BR', {
		timeZone: APPOINTMENT_TIME_ZONE,
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(date)
	return `${day} às ${formatSlotLabel(iso)}`
}

function slotIso (dateKey: string, minuteOfDay: number) {
	const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, '0')
	const mm = String(minuteOfDay % 60).padStart(2, '0')
	return new Date(`${dateKey}T${hh}:${mm}:00${SAO_PAULO_OFFSET}`).toISOString()
}

export function listSlotStarts (dateKey: string) {
	if (!isDateKey(dateKey)) return []
	const rule = DAY_RULES[weekdayIndexInSaoPaulo(dateKey)]
	if (!rule) return []
	const first = rule.opens + OPEN_BUFFER_MINUTES
	const last = rule.closes - SLOT_MINUTES
	const starts: string[] = []
	for (let minute = first; minute <= last; minute += SLOT_MINUTES) {
		starts.push(slotIso(dateKey, minute))
	}
	return starts
}

export function isBookableSlot (iso: string, now = new Date()) {
	const start = new Date(iso)
	if (Number.isNaN(start.getTime())) return false
	if (start.getTime() <= now.getTime()) return false
	const dateKey = formatDateKeySaoPaulo(start)
	if (dateKey > lastBookableDateKey(now)) return false
	return listSlotStarts(dateKey).includes(start.toISOString())
}

export function canCustomerChangeAppointment (startsAt: string, reviewedAt: string | null, status: string, now = new Date()) {
	if (status !== 'orcamento') return false
	if (reviewedAt) return false
	const start = new Date(startsAt)
	if (Number.isNaN(start.getTime())) return false
	return start.getTime() > now.getTime() + 60 * 60 * 1000
}
