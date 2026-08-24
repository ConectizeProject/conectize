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
