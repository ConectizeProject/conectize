import type { SupabaseClient } from '@supabase/supabase-js'
import {
	addBrazilCalendarDays,
	brazilDayRangeUtc,
	brazilTodayDateString,
} from '@/lib/dashboard/brazil-day'
import { FINALIZED_ORDER_STATUSES } from '@/lib/orders/order-status'
import { resolveOrderPayableCents } from '@/lib/orders/order-discount-commission'

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

const FINALIZED_SUCCESS = FINALIZED_ORDER_STATUSES.filter((s) => s !== 'cancelada')

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
 * espelhando a lógica do resumo diário (vendas pagas / OS finalizadas).
 */
export async function fetchDashboardLast7DaysSeries (
	supabase: SupabaseClient,
	organizationId: string,
	now = new Date(),
): Promise<DashboardLast7DaysSeries> {
	const todayStr = brazilTodayDateString(now)
	const startStr = addBrazilCalendarDays(todayStr, -6)
	const { startIso } = brazilDayRangeUtc(startStr)
	const { endIso } = brazilDayRangeUtc(todayStr)

	const salesSeries = emptySeries(todayStr)
	const osSeries = emptySeries(todayStr)
	const salesByDay = new Map(salesSeries.map((p) => [p.dateStr, p]))
	const osByDay = new Map(osSeries.map((p) => [p.dateStr, p]))

	const [salesRes, osRes] = await Promise.all([
		supabase
			.from('sales_orders')
			.select('id, total_cents, created_at')
			.eq('organization_id', organizationId)
			.eq('status', 'paid')
			.gte('created_at', startIso)
			.lte('created_at', endIso),
		supabase
			.from('service_orders')
			.select('id, services_total_cents, services_cost_total_cents, discount_cents, closed_at')
			.eq('organization_id', organizationId)
			.in('status', [...FINALIZED_SUCCESS])
			.gte('closed_at', startIso)
			.lte('closed_at', endIso),
	])

	const paidSales = salesRes.data ?? []
	const orderDay = new Map<string, string>()

	for (const row of paidSales) {
		const id = String(row.id)
		const day = brazilTodayDateString(new Date(String(row.created_at)))
		orderDay.set(id, day)
		const point = salesByDay.get(day)
		if (!point) continue
		point.grossCents += Math.max(0, Number(row.total_cents) || 0)
	}

	const salesIds = paidSales.map((s) => String(s.id))
	if (salesIds.length > 0) {
		const { data: items } = await supabase
			.from('sales_order_items')
			.select('sales_order_id, quantity, unit_cost_cents, subtotal_cents')
			.in('sales_order_id', salesIds)

		const daySubtotal = new Map<string, number>()
		const dayCost = new Map<string, number>()

		for (const item of items ?? []) {
			const day = orderDay.get(String(item.sales_order_id))
			if (!day) continue
			const qty = Math.max(0, Number(item.quantity) || 0)
			const unitCost = Math.max(0, Number(item.unit_cost_cents) || 0)
			const subtotal = Math.max(0, Number(item.subtotal_cents) || 0)
			daySubtotal.set(day, (daySubtotal.get(day) ?? 0) + subtotal)
			dayCost.set(day, (dayCost.get(day) ?? 0) + qty * unitCost)
		}

		for (const [day, subtotal] of daySubtotal) {
			const point = salesByDay.get(day)
			if (!point) continue
			const cost = dayCost.get(day) ?? 0
			point.netCents = Math.max(0, subtotal - cost)
		}
	}

	for (const row of osRes.data ?? []) {
		const closedAt = row.closed_at
		if (!closedAt) continue
		const day = brazilTodayDateString(new Date(String(closedAt)))
		const point = osByDay.get(day)
		if (!point) continue

		const gross = Math.max(0, Number(row.services_total_cents) || 0)
		const discount = Math.max(0, Number(row.discount_cents) || 0)
		const cost = Math.max(0, Number(row.services_cost_total_cents) || 0)
		const payable = resolveOrderPayableCents(gross, discount)
		point.grossCents += payable
		point.netCents += Math.max(0, payable - cost)
	}

	return { sales: salesSeries, os: osSeries }
}
