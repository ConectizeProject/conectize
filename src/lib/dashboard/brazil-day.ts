/** Limites do dia civil no fuso America/Sao_Paulo (sem horário de verão). */

export function brazilTodayDateString (now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now)
}

export function brazilDayRangeUtc (dateStr: string): {
	startIso: string
	endIso: string
	dateStr: string
} {
	const start = new Date(`${dateStr}T00:00:00-03:00`)
	const end = new Date(`${dateStr}T23:59:59.999-03:00`)
	return {
		startIso: start.toISOString(),
		endIso: end.toISOString(),
		dateStr,
	}
}

export type BrazilMonthRange = {
	year: number
	month: number
	label: string
	displayLabel: string
	startDate: string
	endDate: string
	startIso: string
	endIso: string
}

export type BrazilDateRange = {
	label: string
	displayLabel: string
	startDate: string
	endDate: string
	startIso: string
	endIso: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function formatBrDay (dateStr: string) {
	const [y, m, d] = dateStr.split('-')
	return `${d}/${m}/${y}`
}

/** Mês civil (1–12) no fuso America/Sao_Paulo. */
export function brazilMonthRange (year: number, month: number): BrazilMonthRange {
	const y = Math.trunc(year)
	const m = Math.trunc(month)
	if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
		throw new Error('invalid_month_range')
	}
	const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
	const mm = String(m).padStart(2, '0')
	const startDate = `${y}-${mm}-01`
	const endDate = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
	const start = brazilDayRangeUtc(startDate)
	const end = brazilDayRangeUtc(endDate)
	return {
		year: y,
		month: m,
		label: `${y}-${mm}`,
		displayLabel: `${mm}/${y}`,
		startDate,
		endDate,
		startIso: start.startIso,
		endIso: end.endIso,
	}
}

/** Mês civil atual no fuso America/Sao_Paulo. */
export function brazilCurrentMonthRange (now = new Date()): BrazilMonthRange {
	const today = brazilTodayDateString(now)
	const year = Number(today.slice(0, 4))
	const month = Number(today.slice(5, 7))
	return brazilMonthRange(year, month)
}

/** Mês civil anterior no fuso America/Sao_Paulo. */
export function brazilPreviousMonthRange (now = new Date()): BrazilMonthRange {
	const today = brazilTodayDateString(now)
	const year = Number(today.slice(0, 4))
	const month = Number(today.slice(5, 7))
	const prevMonth = month === 1 ? 12 : month - 1
	const prevYear = month === 1 ? year - 1 : year
	return brazilMonthRange(prevYear, prevMonth)
}

/** Intervalo inclusivo de datas civis (YYYY-MM-DD) em America/Sao_Paulo. */
export function brazilInclusiveDateRange (
	fromDate: string,
	toDate: string,
): BrazilDateRange | null {
	const from = String(fromDate || '').trim()
	const to = String(toDate || '').trim()
	if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null
	const startDate = from <= to ? from : to
	const endDate = from <= to ? to : from
	const start = brazilDayRangeUtc(startDate)
	const end = brazilDayRangeUtc(endDate)
	const sameDay = startDate === endDate
	const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7)
		&& startDate.endsWith('-01')
		&& endDate === brazilMonthRange(
			Number(startDate.slice(0, 4)),
			Number(startDate.slice(5, 7)),
		).endDate
	return {
		label: sameDay
			? startDate
			: sameMonth
				? startDate.slice(0, 7)
				: `${startDate}_${endDate}`,
		displayLabel: sameDay
			? formatBrDay(startDate)
			: sameMonth
				? `${startDate.slice(5, 7)}/${startDate.slice(0, 4)}`
				: `${formatBrDay(startDate)} – ${formatBrDay(endDate)}`,
		startDate,
		endDate,
		startIso: start.startIso,
		endIso: end.endIso,
	}
}

export function brazilMonthDay (now = new Date()): { month: number; day: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Sao_Paulo',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(now)
	const month = Number(parts.find((p) => p.type === 'month')?.value || 0)
	const day = Number(parts.find((p) => p.type === 'day')?.value || 0)
	return { month, day }
}

const BRAZIL_DAY_MS = 24 * 60 * 60 * 1000

export function addBrazilCalendarDays (dateStr: string, days: number): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
	const d = new Date(`${dateStr}T12:00:00-03:00`)
	d.setTime(d.getTime() + days * BRAZIL_DAY_MS)
	return brazilTodayDateString(d)
}

/**
 * Aniversário (mês/dia) cai em hoje ou nos próximos `days` dias
 * no calendário de America/Sao_Paulo.
 * `days = 7` cobre hoje e os 7 dias seguintes (hoje até daqui a 7 dias).
 */
export function isBirthdayInNextDays (
	birthDate: string,
	now: Date,
	days: number,
): boolean {
	const bd = String(birthDate || '').slice(0, 10)
	if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || days < 0) return false
	const birthdayMd = bd.slice(5)
	const todayStr = brazilTodayDateString(now)
	for (let i = 0; i <= days; i++) {
		if (addBrazilCalendarDays(todayStr, i).slice(5) === birthdayMd) return true
	}
	return false
}
