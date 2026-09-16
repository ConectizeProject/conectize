import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export type DashboardFinanceTxRow = {
	amount_cents?: number | null
	type?: string | null
	service_order_id?: string | null
	sales_order_id?: string | null
	resale_device_id?: string | null
	description?: string | null
	occurred_at?: string | null
}

export type DashboardFinanceBillingDay = {
	salesGrossCents: number
	salesNetCents: number
	osGrossCents: number
	osNetCents: number
	salesOrderIds: string[]
	serviceOrderIds: string[]
}

function financeClient (fallback: SupabaseClient): SupabaseClient {
	try {
		return createSupabaseServiceClient()
	} catch {
		return fallback
	}
}

export function classifyDashboardFinanceSource (
	row: DashboardFinanceTxRow,
): 'os' | 'pdv' | 'seminovo' | 'other' {
	if (row.service_order_id) return 'os'
	if (row.sales_order_id) return 'pdv'
	if (row.resale_device_id) return 'seminovo'
	if (/^PDV:[0-9a-fA-F-]{36}:/i.test(String(row.description || ''))) return 'pdv'
	return 'other'
}

function ymd (value: unknown): string {
	return String(value || '').slice(0, 10)
}

/**
 * Faturamento do dashboard alinhado ao Financeiro:
 * entradas em `financial_transactions` por `occurred_at` (data civil).
 */
export async function fetchDashboardFinanceBillingByDateRange (
	supabase: SupabaseClient,
	organizationId: string,
	fromDateStr: string,
	toDateStr: string,
): Promise<Map<string, DashboardFinanceBillingDay>> {
	const byDay = new Map<string, DashboardFinanceBillingDay>()

	function emptyDay (): DashboardFinanceBillingDay {
		return {
			salesGrossCents: 0,
			salesNetCents: 0,
			osGrossCents: 0,
			osNetCents: 0,
			salesOrderIds: [],
			serviceOrderIds: [],
		}
	}

	function dayBucket (dateStr: string): DashboardFinanceBillingDay {
		let bucket = byDay.get(dateStr)
		if (!bucket) {
			bucket = emptyDay()
			byDay.set(dateStr, bucket)
		}
		return bucket
	}

	const client = financeClient(supabase)
	const { data, error } = await client
		.from('financial_transactions')
		.select(
			'amount_cents, type, service_order_id, sales_order_id, resale_device_id, description, occurred_at',
		)
		.eq('organization_id', organizationId)
		.eq('type', 'entrada')
		.gte('occurred_at', fromDateStr)
		.lte('occurred_at', toDateStr)

	if (error) {
		console.error('[dashboard finance-billing]', error)
		return byDay
	}

	const salesIdsByDay = new Map<string, Set<string>>()
	const osIdsByDay = new Map<string, Set<string>>()
	const osPayByDay = new Map<string, Map<string, number>>()

	for (const raw of data ?? []) {
		const row = raw as DashboardFinanceTxRow
		const day = ymd(row.occurred_at)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
		const source = classifyDashboardFinanceSource(row)
		if (source !== 'os' && source !== 'pdv') continue
		const amount = Math.max(0, Number(row.amount_cents) || 0)
		if (amount <= 0) continue

		const bucket = dayBucket(day)
		if (source === 'pdv') {
			bucket.salesGrossCents += amount
			const sid = row.sales_order_id ? String(row.sales_order_id) : ''
			if (sid) {
				let set = salesIdsByDay.get(day)
				if (!set) {
					set = new Set()
					salesIdsByDay.set(day, set)
				}
				set.add(sid)
			}
		} else {
			bucket.osGrossCents += amount
			const oid = row.service_order_id ? String(row.service_order_id) : ''
			if (oid) {
				let set = osIdsByDay.get(day)
				if (!set) {
					set = new Set()
					osIdsByDay.set(day, set)
				}
				set.add(oid)
				let payMap = osPayByDay.get(day)
				if (!payMap) {
					payMap = new Map()
					osPayByDay.set(day, payMap)
				}
				payMap.set(oid, (payMap.get(oid) ?? 0) + amount)
			}
		}
	}

	const allSalesIds = [...new Set([...salesIdsByDay.values()].flatMap((s) => [...s]))]
	const allOsIds = [...new Set([...osIdsByDay.values()].flatMap((s) => [...s]))]

	const salesCostById = new Map<string, { subtotal: number; cost: number }>()
	if (allSalesIds.length > 0) {
		const { data: items } = await supabase
			.from('sales_order_items')
			.select('sales_order_id, quantity, unit_cost_cents, subtotal_cents')
			.in('sales_order_id', allSalesIds)
		for (const item of items ?? []) {
			const id = String(item.sales_order_id || '')
			if (!id) continue
			const qty = Math.max(0, Number(item.quantity) || 0)
			const unitCost = Math.max(0, Number(item.unit_cost_cents) || 0)
			const subtotal = Math.max(0, Number(item.subtotal_cents) || 0)
			const prev = salesCostById.get(id) ?? { subtotal: 0, cost: 0 }
			prev.subtotal += subtotal
			prev.cost += qty * unitCost
			salesCostById.set(id, prev)
		}
	}

	const osCostById = new Map<string, number>()
	if (allOsIds.length > 0) {
		const { data: orders } = await supabase
			.from('service_orders')
			.select('id, services_cost_total_cents')
			.in('id', allOsIds)
		for (const order of orders ?? []) {
			const id = String(order.id || '')
			if (!id) continue
			osCostById.set(id, Math.max(0, Number(order.services_cost_total_cents) || 0))
		}
	}

	for (const [day, bucket] of byDay) {
		const salesIds = [...(salesIdsByDay.get(day) ?? [])]
		bucket.salesOrderIds = salesIds
		let salesNet = 0
		for (const id of salesIds) {
			const row = salesCostById.get(id)
			if (!row) continue
			salesNet += Math.max(0, row.subtotal - row.cost)
		}
		bucket.salesNetCents = salesNet

		const osIds = [...(osIdsByDay.get(day) ?? [])]
		bucket.serviceOrderIds = osIds
		const payMap = osPayByDay.get(day) ?? new Map()
		let osNet = 0
		for (const id of osIds) {
			const paid = payMap.get(id) ?? 0
			const cost = osCostById.get(id) ?? 0
			osNet += Math.max(0, paid - cost)
		}
		bucket.osNetCents = osNet
	}

	return byDay
}
