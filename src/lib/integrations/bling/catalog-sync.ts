import type { SupabaseClient } from '@supabase/supabase-js'
import {
	enrichListItemsWithDetails,
	type BlingListResponse,
	type BlingRequestClient,
	upsertBlingProductForOrganization,
} from '@/lib/integrations/bling/product-upsert'

export type BlingCatalogSyncSummary = {
	fetched: number
	created: number
	updated: number
	skipped: number
	errors: string[]
	truncated: boolean
}

const PAGE_SIZE = 100
const MAX_PAGES = 100

export async function syncBlingCatalogForOrganization (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
}): Promise<BlingCatalogSyncSummary> {
	const summary: BlingCatalogSyncSummary = {
		fetched: 0,
		created: 0,
		updated: 0,
		skipped: 0,
		errors: [],
		truncated: false,
	}

	const upsertedBlingIds = new Set<string>()

	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const data = await params.client.request<BlingListResponse>({
			method: 'GET',
			path: '/produtos',
			query: { pagina: page, limite: PAGE_SIZE },
		})

		const items = data?.data ?? data?.itens ?? []
		if (!Array.isArray(items) || items.length === 0) {
			break
		}

		summary.fetched += items.length

		const enriched = await enrichListItemsWithDetails(params.client, items)

		for (const item of enriched) {
			const blingId = String(item.local.blingId || '').trim()
			if (!blingId) {
				summary.skipped += 1
				continue
			}
			if (upsertedBlingIds.has(blingId)) {
				summary.skipped += 1
				continue
			}
			upsertedBlingIds.add(blingId)

			try {
				const result = await upsertBlingProductForOrganization({
					supabase: params.supabase,
					organizationId: params.organizationId,
					userId: params.actorUserId,
					local: item.local,
					externalReference: `bling:catalog-sync:${blingId}`,
				})

				if (result.action === 'created') summary.created += 1
				else if (result.action === 'updated') summary.updated += 1
				else summary.skipped += 1
			} catch (err) {
				const message = err instanceof Error ? err.message : 'unknown_error'
				summary.errors.push(`${blingId}: ${message}`)
			}
		}

		if (items.length < PAGE_SIZE) {
			break
		}

		if (page === MAX_PAGES) {
			summary.truncated = true
		}
	}

	return summary
}

export async function syncBlingCatalogPage (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
	page: number
	limit?: number
}): Promise<{ imported: number; updated: number; fetched: number }> {
	const limit = Math.min(Math.max(params.limit ?? PAGE_SIZE, 1), 100)
	const data = await params.client.request<BlingListResponse>({
		method: 'GET',
		path: '/produtos',
		query: { pagina: params.page, limite: limit },
	})

	const items = data?.data ?? data?.itens ?? []
	if (!Array.isArray(items) || items.length === 0) {
		return { imported: 0, updated: 0, fetched: 0 }
	}

	const enriched = await enrichListItemsWithDetails(params.client, items)
	let imported = 0
	let updated = 0

	for (const item of enriched) {
		const blingId = String(item.local.blingId || '').trim()
		if (!blingId) continue

		const result = await upsertBlingProductForOrganization({
			supabase: params.supabase,
			organizationId: params.organizationId,
			userId: params.actorUserId,
			local: item.local,
			externalReference: `bling:import-products:${blingId}`,
		})

		if (result.action === 'created') imported += 1
		else if (result.action === 'updated') updated += 1
	}

	return { imported, updated, fetched: items.length }
}
