import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	searchMeliOrdersByCreatedAt,
	type HubConnection,
} from '@/lib/integrations/mercado-livre/api'
import { syncMeliOrderById } from '@/lib/integrations/mercado-livre/order-sync'

export const MELI_RECENT_ORDERS_DAYS = 60
const MELI_RECENT_ORDERS_PAGE_LIMIT = 50
const MELI_RECENT_ORDERS_MAX = 500
const MELI_RECENT_ORDER_STATUSES = ['paid', 'cancelled'] as const

export function formatMeliSearchDate(date: Date): string {
	return date.toISOString().replace(/Z$/, '-00:00')
}

export function meliRecentOrdersWindow(now = new Date()): {
	from: string
	to: string
} {
	const to = new Date(now)
	const from = new Date(
		now.getTime() - MELI_RECENT_ORDERS_DAYS * 24 * 60 * 60 * 1000,
	)
	return {
		from: formatMeliSearchDate(from),
		to: formatMeliSearchDate(to),
	}
}

export function meliOrderIdsFromSearch(payload: unknown): string[] {
	const page =
		payload && typeof payload === 'object' && !Array.isArray(payload)
			? (payload as { results?: unknown })
			: null
	const results = Array.isArray(page?.results) ? page.results : []
	const ids: string[] = []
	const seen = new Set<string>()
	for (const row of results) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) continue
		const raw = (row as { id?: unknown }).id
		if (raw == null) continue
		const id = String(raw).trim()
		if (!id || seen.has(id)) continue
		seen.add(id)
		ids.push(id)
	}
	return ids
}

function sellerIdFromConnection(connection: HubConnection): string | null {
	const raw = connection.metadata?.user_id
	if (raw == null) return null
	const sellerId = String(raw).trim()
	return sellerId || null
}

function pagingTotal(payload: { paging?: { total?: number } }): number | null {
	const total = Number(payload.paging?.total)
	return Number.isFinite(total) && total >= 0 ? total : null
}

export async function importMeliOrdersFromLastWeek(params: {
	supabase: SupabaseClient
	organizationId: string
	now?: Date
}): Promise<{
	imported: number
	failed: number
	created: number
	verified: number
}> {
	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) throw new Error('meli_not_connected')

	const sellerId = sellerIdFromConnection(connection)
	if (!sellerId) throw new Error('meli_user_id_missing_in_connection')

	const window = meliRecentOrdersWindow(params.now)
	const ids: string[] = []
	const seen = new Set<string>()

	for (const status of MELI_RECENT_ORDER_STATUSES) {
		let offset = 0
		while (ids.length < MELI_RECENT_ORDERS_MAX) {
			const page = await searchMeliOrdersByCreatedAt(
				connection,
				{
					sellerId,
					from: window.from,
					to: window.to,
					status,
					offset,
					limit: MELI_RECENT_ORDERS_PAGE_LIMIT,
				},
				params.supabase,
			)
			const batch = meliOrderIdsFromSearch(page)
			if (batch.length === 0) break
			for (const id of batch) {
				if (seen.has(id) || ids.length >= MELI_RECENT_ORDERS_MAX) continue
				seen.add(id)
				ids.push(id)
			}
			offset += batch.length
			const total = pagingTotal(page)
			if (batch.length < MELI_RECENT_ORDERS_PAGE_LIMIT) break
			if (total != null && offset >= total) break
		}
	}

	let imported = 0
	let failed = 0
	let created = 0
	let verified = 0
	for (const orderId of ids) {
		try {
			const result = await syncMeliOrderById({
				supabase: params.supabase,
				organizationId: params.organizationId,
				orderId,
			})
			imported += 1
			if (result.action === 'skipped' || result.action === 'updated' || result.action === 'canceled') {
				// Já existia: só confere data da compra, fulfillment, etc.
				verified += 1
			} else {
				created += 1
			}
		} catch (err) {
			failed += 1
			const message = err instanceof Error ? err.message : 'unknown_error'
			console.error('[meli recent order]', orderId, message)
		}
	}

	return { imported, failed, created, verified }
}
