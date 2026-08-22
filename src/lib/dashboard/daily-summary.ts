import type { SupabaseClient } from '@supabase/supabase-js'
import { brazilDayRangeUtc, brazilMonthDay, brazilTodayDateString } from '@/lib/dashboard/brazil-day'
import {
	FINALIZED_ORDER_STATUSES,
	OPEN_ORDER_STATUS_SET,
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
	type RecurringPendingDto,
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

export type DashboardReceivableGroup =
	| 'em_aberto'
	| 'aguardando_retirada'
	| 'outros'

export type DashboardReceivableItem = {
	id: string
	displayNumber: string | null
	label: string
	openCents: number
	status: string
	group: DashboardReceivableGroup
}

export type DashboardBirthdayItem = {
	id: string
	name: string
	birthDate: string
}

export type DashboardDevicesSummary = {
	availableCount: number
	soldTodayCount: number
	grossCents: number
	netCents: number
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
	receivables: DashboardReceivableItem[]
	payables: RecurringPendingDto[]
	birthdays: DashboardBirthdayItem[]
}

const FINALIZED_SUCCESS = FINALIZED_ORDER_STATUSES.filter((s) => s !== 'cancelada')

function classifyReceivableGroup (status: string): DashboardReceivableGroup {
	if (status === 'aguardando_retirada') return 'aguardando_retirada'
	if (OPEN_ORDER_STATUS_SET.has(status)) return 'em_aberto'
	return 'outros'
}

export async function fetchDashboardDailySummary (
	supabase: SupabaseClient,
	organizationId: string,
	opts?: { includeFinanceReminders?: boolean },
): Promise<DashboardDailySummary> {
	const includeFinance = opts?.includeFinanceReminders !== false
	const now = new Date()
	const dateStr = brazilTodayDateString(now)
	const { startIso, endIso } = brazilDayRangeUtc(dateStr)
	const { month, day } = brazilMonthDay(now)

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

	const receivablesPromise = supabase
		.from('service_orders')
		.select('id, display_number, status, title, services_total_cents, services_cost_total_cents, payment_methods')
		.eq('organization_id', organizationId)
		.not('status', 'eq', 'cancelada')
		.order('updated_at', { ascending: false })
		.limit(80)

	const birthdaysPromise = supabase
		.from('customers')
		.select('id, full_name, company_name, trade_name, is_company, birth_date')
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
		openOsRes,
		finalizedOsRes,
		receivablesRes,
		birthdaysRes,
		availableDevicesRes,
		soldDevicesTodayRes,
		recurringRes,
	] = await Promise.all([
		orgPromise,
		salesPromise,
		openOsPromise,
		finalizedOsPromise,
		receivablesPromise,
		birthdaysPromise,
		availableDevicesPromise,
		soldDevicesTodayPromise,
		recurringPromise,
	])

	const paidSales = salesRes.data ?? []
	const salesIds = paidSales.map((s) => String(s.id))
	let unitsSold = 0
	let itemsCostCents = 0
	let itemsSubtotalCents = 0

	if (salesIds.length > 0) {
		const { data: items } = await supabase
			.from('sales_order_items')
			.select('quantity, unit_cost_cents, subtotal_cents')
			.in('sales_order_id', salesIds)

		for (const item of items ?? []) {
			const qty = Math.max(0, Number(item.quantity) || 0)
			const unitCost = Math.max(0, Number(item.unit_cost_cents) || 0)
			const subtotal = Math.max(0, Number(item.subtotal_cents) || 0)
			unitsSold += qty
			itemsCostCents += qty * unitCost
			itemsSubtotalCents += subtotal
		}
	}

	const salesValueCents = paidSales.reduce(
		(acc, s) => acc + Math.max(0, Number(s.total_cents) || 0),
		0,
	)
	const salesNetProfitCents = Math.max(0, itemsSubtotalCents - itemsCostCents)

	let osGrossCents = 0
	let osNetCents = 0
	for (const row of finalizedOsRes.data ?? []) {
		const gross = Math.max(0, Number(row.services_total_cents) || 0)
		const discount = Math.max(0, Number(row.discount_cents) || 0)
		const cost = Math.max(0, Number(row.services_cost_total_cents) || 0)
		const payable = resolveOrderPayableCents(gross, discount)
		osGrossCents += payable
		osNetCents += Math.max(0, payable - cost)
	}

	const receivables: DashboardReceivableItem[] = []
	for (const row of receivablesRes.data ?? []) {
		const enriched = enrichOrderFinance(row as OrderFinanceInput)
		if (enriched.valorEmAbertoCents <= 0) continue
		const status = String(row.status || '')
		receivables.push({
			id: String(row.id),
			displayNumber: row.display_number != null ? String(row.display_number) : null,
			label: String(row.title || 'Ordem de serviço').trim() || 'Ordem de serviço',
			openCents: enriched.valorEmAbertoCents,
			status,
			group: classifyReceivableGroup(status),
		})
		if (receivables.length >= 40) break
	}

	const birthdays: DashboardBirthdayItem[] = []
	for (const c of birthdaysRes.data ?? []) {
		const bd = String(c.birth_date || '').slice(0, 10)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) continue
		const [, m, d] = bd.split('-').map(Number)
		if (m !== month || d !== day) continue
		const name = c.is_company
			? String(c.trade_name || c.company_name || c.full_name || 'Cliente').trim()
			: String(c.full_name || c.trade_name || 'Cliente').trim()
		birthdays.push({ id: String(c.id), name, birthDate: bd })
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
		receivables,
		payables,
		birthdays,
	}
}
