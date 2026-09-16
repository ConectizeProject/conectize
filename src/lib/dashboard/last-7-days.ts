import type { SupabaseClient } from '@supabase/supabase-js'
import {
	addBrazilCalendarDays,
	brazilTodayDateString,
} from '@/lib/dashboard/brazil-day'
import { fetchDashboardFinanceBillingByDateRange } from '@/lib/dashboard/finance-billing'

export type DashboardDaySeriesPoint = {
	dateStr: string
	label: string
	grossCents: number
	netCents: number
}

export type DashboardLast7DaysSeries = {
	sales: DashboardDaySeriesPoint[]
	os: DashboardDaySeriesPoint[]
}

function brazilDayShortLabel (dateStr: string): string {
	const d = new Date(`${dateStr}T12:00:00-03:00`)
	const weekday = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		weekday: 'short',
	})
		.format(d)
		.replace(/\.$/, '')
	const day = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		day: '2-digit',
	}).format(d)
	return `${weekday} ${day}`
}

function emptySeries (endDateStr: string): DashboardDaySeriesPoint[] {
	const points: DashboardDaySeriesPoint[] = []
	for (let i = 6; i >= 0; i -= 1) {
		const dateStr = addBrazilCalendarDays(endDateStr, -i)
		points.push({
			dateStr,
			label: brazilDayShortLabel(dateStr),
			grossCents: 0,
			netCents: 0,
		})
	}
	return points
}

/**
 * Faturamento bruto + margem líquida dos últimos 7 dias (calendário BR),
 * alinhado ao Financeiro (`financial_transactions.occurred_at`).
 */
export async function fetchDashboardLast7DaysSeries (
	supabase: SupabaseClient,
	organizationId: string,
	now = new Date(),
): Promise<DashboardLast7DaysSeries> {
	const todayStr = brazilTodayDateString(now)
	const startStr = addBrazilCalendarDays(todayStr, -6)

	const salesSeries = emptySeries(todayStr)
	const osSeries = emptySeries(todayStr)
	const salesByDay = new Map(salesSeries.map((p) => [p.dateStr, p]))
	const osByDay = new Map(osSeries.map((p) => [p.dateStr, p]))

	const financeByDay = await fetchDashboardFinanceBillingByDateRange(
		supabase,
		organizationId,
		startStr,
		todayStr,
	)

	for (const [day, billing] of financeByDay) {
		const salesPoint = salesByDay.get(day)
		if (salesPoint) {
			salesPoint.grossCents = billing.salesGrossCents
			salesPoint.netCents = billing.salesNetCents
		}
		const osPoint = osByDay.get(day)
		if (osPoint) {
			osPoint.grossCents = billing.osGrossCents
			osPoint.netCents = billing.osNetCents
		}
	}

	return { sales: salesSeries, os: osSeries }
}
