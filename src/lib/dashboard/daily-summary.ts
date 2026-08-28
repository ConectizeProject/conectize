import type { SupabaseClient } from '@supabase/supabase-js'
import { brazilDayRangeUtc, brazilTodayDateString, addBrazilCalendarDays, isBirthdayInNextDays } from '@/lib/dashboard/brazil-day'
import {
	FINALIZED_ORDER_STATUSES,
	OPEN_ORDER_STATUSES,
} from '@/lib/orders/order-status'
import { resolveOrderPayableCents } from '@/lib/orders/order-discount-commission'
import {
	enrichOrderFinance,
	type OrderFinanceInput,
} from '@/lib/portal/retailer-finance-helpers'
import {
	mapRecurringRowsToPending,
	recurringInvoiceVisibleInShortList,
	type RecurringRowInput,
} from '@/lib/finance/recurring-due'

export type DashboardSalesSummary = {
	salesCount: number
	unitsSold: number
	salesValueCents: number
	netProfitCents: number
}

export type DashboardOsSummary = {
	activeCount: number
	finalizedTodayCount: number
	grossCents: number
	netCents: number
}

export type DashboardRemindersSummary = {
	openOsReceivableCents: number
	payablesTotalCents: number
	birthdaysNext7DaysCount: number
	averageTicketCents: number
}

export type DashboardDevicesSummary = {
	availableCount: number
	soldTodayCount: number
	grossCents: number
	netCents: number
}

export type DashboardYesterdayBilling = {
	salesCents: number
	salesNetCents: number
	osCents: number
	osNetCents: number
}

export type DashboardDailySummary = {
	dateStr: string
	sales: DashboardSalesSummary
	os: DashboardOsSummary
	devices: DashboardDevicesSummary
	dailySalesGoalCents: number
	dailyOsGoalCents: number
	billingSalesCents: number
	billingOsCents: number
	yesterday: DashboardYesterdayBilling
	reminders: DashboardRemindersSummary
}

const FINALIZED_SUCCESS = FINALIZED_ORDER_STATUSES.filter((s) => s !== 'cancelada')

type OsFinanceRow = {
	services_total_cents?: number | null
	services_cost_total_cents?: number | null
	discount_cents?: number | null
}

function sumFinalizedOs (rows: OsFinanceRow[]): { grossCents: number; netCents: number } {
	let grossCents = 0
	let netCents = 0
	for (const row of rows) {
		const gross = Math.max(0, Number(row.services_total_cents) || 0)
		const discount = Math.max(0, Number(row.discount_cents) || 0)
		const cost = Math.max(0, Number(row.services_cost_total_cents) || 0)
		const payable = resolveOrderPayableCents(gross, discount)
		grossCents += payable
		netCents += Math.max(0, payable - cost)
	}
	return { grossCents, netCents }
}

export async function fetchDashboardDailySummary (
	supabase: SupabaseClient,
	organizationId: string,
	opts?: { includeFinanceReminders?: boolean },
): Promise<DashboardDailySummary> {
	const includeFinance = opts?.includeFinanceReminders !== false
	const now = new Date()
	const dateStr = brazilTodayDateString(now)
	const yesterdayStr = addBrazilCalendarDays(dateStr, -1)
	const { startIso, endIso } = brazilDayRangeUtc(dateStr)
	const yesterdayRange = brazilDayRangeUtc(yesterdayStr)

	const orgPromise = supabase
		.from('organizations')
		.select('daily_sales_revenue_goal_cents, daily_os_revenue_goal_cents')
		.eq('id', organizationId)
		.maybeSingle()

	const salesPromise = supabase
		.from('sales_orders')
		.select('id, total_cents')
		.eq('organization_id', organizationId)
		.eq('status', 'paid')
		.gte('created_at', startIso)
		.lte('created_at', endIso)

	const openOsPromise = supabase
		.from('service_orders')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', organizationId)
		.in('status', [...OPEN_ORDER_STATUSES])

	const finalizedOsPromise = supabase
		.from('service_orders')
		.select('id, services_total_cents, services_cost_total_cents, discount_cents')
		.eq('organization_id', organizationId)
		.in('status', [...FINALIZED_SUCCESS])
		.gte('closed_at', startIso)
		.lte('closed_at', endIso)

	const yesterdaySalesPromise = supabase
		.from('sales_orders')
		.select('id, total_cents')
		.eq('organization_id', organizationId)
		.eq('status', 'paid')
		.gte('created_at', yesterdayRange.startIso)
		.lte('created_at', yesterdayRange.endIso)

	const yesterdayFinalizedOsPromise = supabase
		.from('service_orders')
		.select('id, services_total_cents, services_cost_total_cents, discount_cents')
		.eq('organization_id', organizationId)
		.in('status', [...FINALIZED_SUCCESS])
		.gte('closed_at', yesterdayRange.startIso)
		.lte('closed_at', yesterdayRange.endIso)

	const openReceivablesPromise = supabase
		.from('service_orders')
		.select('id, status, services_total_cents, services_cost_total_cents, payment_methods')
		.eq('organization_id', organizationId)
		.in('status', [...OPEN_ORDER_STATUSES])

	const birthdaysPromise = supabase
		.from('customers')
		.select('id, birth_date')
		.eq('organization_id', organizationId)
		.not('birth_date', 'is', null)
		.limit(500)

	const availableDevicesPromise = supabase
		.from('resale_devices')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', organizationId)
		.eq('sold', false)

	const soldDevicesTodayPromise = supabase
		.from('resale_devices')
		.select('id, sold_for_cents, actual_profit_cents')
		.eq('organization_id', organizationId)
		.eq('sold', true)
		.eq('sale_date', dateStr)

	const recurringPromise = includeFinance
		? supabase
			.from('recurring_expenses')
			.select('id, description, amount_cents, conta_id, billing_day, is_active, last_generated_for, contas(name)')
			.eq('is_active', true)
		: Promise.resolve({ data: null as RecurringRowInput[] | null })

	const [
		orgRes,
		salesRes,
		yesterdaySalesRes,
		openOsRes,
		finalizedOsRes,
		yesterdayFinalizedOsRes,
		openReceivablesRes,
		birthdaysRes,
		availableDevicesRes,
		soldDevicesTodayRes,
		recurringRes,
	] = await Promise.all([
		orgPromise,
		salesPromise,
		yesterdaySalesPromise,
		openOsPromise,
		finalizedOsPromise,
		yesterdayFinalizedOsPromise,
		openReceivablesPromise,
		birthdaysPromise,
		availableDevicesPromise,
		soldDevicesTodayPromise,
		recurringPromise,
	])

	const paidSales = salesRes.data ?? []
	const yesterdayPaidSales = yesterdaySalesRes.data ?? []
	const salesIds = paidSales.map((s) => String(s.id))
	const yesterdaySalesIds = yesterdayPaidSales.map((s) => String(s.id))

	const emptyItems = { data: [] as Array<{
		quantity?: number | null
		unit_cost_cents?: number | null
		subtotal_cents?: number | null
	}> }
	const [todayItemsRes, yesterdayItemsRes] = await Promise.all([
		salesIds.length > 0
			? supabase
				.from('sales_order_items')
				.select('quantity, unit_cost_cents, subtotal_cents')
				.in('sales_order_id', salesIds)
			: Promise.resolve(emptyItems),
		yesterdaySalesIds.length > 0
			? supabase
				.from('sales_order_items')
				.select('quantity, unit_cost_cents, subtotal_cents')
				.in('sales_order_id', yesterdaySalesIds)
			: Promise.resolve(emptyItems),
	])

	let unitsSold = 0
	let itemsCostCents = 0
	let itemsSubtotalCents = 0
	for (const item of todayItemsRes.data ?? []) {
		const qty = Math.max(0, Number(item.quantity) || 0)
		const unitCost = Math.max(0, Number(item.unit_cost_cents) || 0)
		const subtotal = Math.max(0, Number(item.subtotal_cents) || 0)
		unitsSold += qty
		itemsCostCents += qty * unitCost
		itemsSubtotalCents += subtotal
	}

	let yesterdayItemsCostCents = 0
	let yesterdayItemsSubtotalCents = 0
	for (const item of yesterdayItemsRes.data ?? []) {
		const qty = Math.max(0, Number(item.quantity) || 0)
		const unitCost = Math.max(0, Number(item.unit_cost_cents) || 0)
		const subtotal = Math.max(0, Number(item.subtotal_cents) || 0)
		yesterdayItemsCostCents += qty * unitCost
		yesterdayItemsSubtotalCents += subtotal
	}

	const salesValueCents = paidSales.reduce(
		(acc, s) => acc + Math.max(0, Number(s.total_cents) || 0),
		0,
	)
	const yesterdaySalesValueCents = yesterdayPaidSales.reduce(
		(acc, s) => acc + Math.max(0, Number(s.total_cents) || 0),
		0,
	)
	const salesNetProfitCents = Math.max(0, itemsSubtotalCents - itemsCostCents)
	const yesterdaySalesNetCents = Math.max(
		0,
		yesterdayItemsSubtotalCents - yesterdayItemsCostCents,
	)

	const osToday = sumFinalizedOs(finalizedOsRes.data ?? [])
	const osYesterday = sumFinalizedOs(yesterdayFinalizedOsRes.data ?? [])
	const osGrossCents = osToday.grossCents
	const osNetCents = osToday.netCents

	let openOsReceivableCents = 0
	for (const row of openReceivablesRes.data ?? []) {
		const enriched = enrichOrderFinance(row as OrderFinanceInput)
		openOsReceivableCents += Math.max(0, enriched.valorEmAbertoCents)
	}

	let birthdaysNext7DaysCount = 0
	for (const c of birthdaysRes.data ?? []) {
		if (isBirthdayInNextDays(String(c.birth_date || ''), now, 7)) {
			birthdaysNext7DaysCount += 1
		}
	}

	const payables = includeFinance
		? mapRecurringRowsToPending(
			(recurringRes.data ?? []) as RecurringRowInput[],
			now,
		).filter((p) => recurringInvoiceVisibleInShortList(p, now))
		: []

	const soldToday = soldDevicesTodayRes.data ?? []
	let devicesGrossCents = 0
	let devicesNetCents = 0
	for (const row of soldToday) {
		devicesGrossCents += Math.max(0, Number(row.sold_for_cents) || 0)
		devicesNetCents += Number(row.actual_profit_cents) || 0
	}

	const dailySalesGoalCents = Math.max(
		0,
		Number(orgRes.data?.daily_sales_revenue_goal_cents) || 0,
	)
	const dailyOsGoalCents = Math.max(
		0,
		Number(orgRes.data?.daily_os_revenue_goal_cents) || 0,
	)

	return {
		dateStr,
		sales: {
			salesCount: paidSales.length,
			unitsSold,
			salesValueCents,
			netProfitCents: salesNetProfitCents,
		},
		os: {
			activeCount: openOsRes.count ?? 0,
			finalizedTodayCount: (finalizedOsRes.data ?? []).length,
			grossCents: osGrossCents,
			netCents: osNetCents,
		},
		devices: {
			availableCount: availableDevicesRes.count ?? 0,
			soldTodayCount: soldToday.length,
			grossCents: devicesGrossCents,
			netCents: devicesNetCents,
		},
		dailySalesGoalCents,
		dailyOsGoalCents,
		billingSalesCents: salesValueCents,
		billingOsCents: osGrossCents,
		yesterday: {
			salesCents: yesterdaySalesValueCents,
			salesNetCents: yesterdaySalesNetCents,
			osCents: osYesterday.grossCents,
			osNetCents: osYesterday.netCents,
		},
		reminders: {
			openOsReceivableCents,
			payablesTotalCents: payables.reduce((acc, p) => acc + Math.max(0, Number(p.amount_cents) || 0), 0),
			birthdaysNext7DaysCount,
			averageTicketCents: paidSales.length > 0
				? Math.round(salesValueCents / paidSales.length)
				: 0,
		},
	}
}
