import type { SupabaseClient } from '@supabase/supabase-js'
import { blingProdutoApiPath } from '@/lib/integrations/bling/api'
import { BLING_TOO_MANY_REQUESTS, isBlingTooManyRequests } from '@/lib/integrations/bling/bling-rate-limit'
import { blingCatalogSyncErrorMessage, hasStoredBlingDetail } from '@/lib/integrations/bling/catalog-sync-rules'
import {
	emptyBlingCatalogSyncView,
	type BlingCatalogSyncAction,
	type BlingCatalogSyncStatus,
	type BlingCatalogSyncView,
} from '@/lib/integrations/bling/catalog-sync-types'
import { mapBlingProductToLocal } from '@/lib/integrations/bling/mappers'
import {
	enrichListItemsWithDetails,
	mapBlingCatalogListItems,
	type BlingListResponse,
	type BlingRequestClient,
	upsertBlingProductForOrganization,
} from '@/lib/integrations/bling/product-upsert'

const PAGE_SIZE = 100
const MAX_PAGES = 100
const DETAIL_BATCH = 12
const OPEN_STATUSES = ['listing', 'detailing', 'paused', 'error'] as const

type RunStatus = 'listing' | 'detailing' | 'paused' | 'completed' | 'error'

type RunRow = {
	id: string
	organization_id: string
	status: RunStatus
	total_listed: number
	created_count: number
	updated_count: number
	detailed_count: number
	failed_count: number
	skipped_detail_count: number
	last_page: number
	census_done: boolean
	truncated: boolean
	error_message: string | null
}

type ProductCounts = {
	imported: number
	pendingDetail: number
	failed: number
}

type DetailRow = {
	id: string
	bling_id: string
}

function int (value: unknown) {
	const n = Number(value)
	return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

function asRun (row: unknown): RunRow | null {
	if (!row || typeof row !== 'object') return null
	const record = row as Record<string, unknown>
	const status = String(record.status || '')
	if (
		status !== 'listing'
		&& status !== 'detailing'
		&& status !== 'paused'
		&& status !== 'completed'
		&& status !== 'error'
	) {
		return null
	}
	const id = String(record.id || '').trim()
	const organizationId = String(record.organization_id || '').trim()
	if (!id || !organizationId) return null
	return {
		id,
		organization_id: organizationId,
		status,
		total_listed: int(record.total_listed),
		created_count: int(record.created_count),
		updated_count: int(record.updated_count),
		detailed_count: int(record.detailed_count),
		failed_count: int(record.failed_count),
		skipped_detail_count: int(record.skipped_detail_count),
		last_page: int(record.last_page),
		census_done: record.census_done === true,
		truncated: record.truncated === true,
		error_message: record.error_message != null ? String(record.error_message) : null,
	}
}

function isRateLimitError (err: unknown) {
	const message = err instanceof Error ? err.message : String(err || '')
	return message === BLING_TOO_MANY_REQUESTS || isBlingTooManyRequests(0, message)
}

function clipError (err: unknown) {
	const message = err instanceof Error ? err.message : 'unknown_error'
	return message.slice(0, 400)
}

function toView (
	run: RunRow | null,
	counts: ProductCounts,
	extra?: { advanced?: boolean, message?: string | null },
): BlingCatalogSyncView {
	const base = emptyBlingCatalogSyncView()
	if (!run) {
		return {
			...base,
			imported: counts.imported,
			pendingDetail: counts.pendingDetail,
			failed: counts.failed,
			advanced: extra?.advanced === true,
			message: extra?.message ?? null,
		}
	}
	const status: BlingCatalogSyncStatus = run.status
	const errorMessage = run.error_message
	const message = extra?.message !== undefined
		? extra.message
		: (status === 'paused' || status === 'error'
			? blingCatalogSyncErrorMessage(errorMessage)
			: null)
	return {
		ok: true,
		runId: run.id,
		status,
		totalListed: run.total_listed,
		created: run.created_count,
		updated: run.updated_count,
		detailed: run.detailed_count,
		failed: counts.failed,
		pendingDetail: counts.pendingDetail,
		skippedDetail: run.skipped_detail_count,
		imported: counts.imported,
		lastPage: run.last_page,
		censusDone: run.census_done,
		truncated: run.truncated,
		advanced: extra?.advanced === true,
		errorMessage,
		message,
	}
}

function countsFromRun (run: RunRow | null): ProductCounts {
	if (!run) return { imported: 0, pendingDetail: 0, failed: 0 }
	const imported = run.created_count + run.updated_count
	const accounted = run.skipped_detail_count + run.detailed_count + run.failed_count
	return {
		imported,
		pendingDetail: Math.max(0, imported - accounted),
		failed: run.failed_count,
	}
}

async function loadOpenRun (supabase: SupabaseClient, organizationId: string) {
	const { data, error } = await supabase
		.from('bling_catalog_sync_runs')
		.select('*')
		.eq('organization_id', organizationId)
		.in('status', [...OPEN_STATUSES])
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle()
	if (error) {
		console.error('[bling-catalog-sync] load_open_run', error.message)
		return null
	}
	return asRun(data)
}

async function loadLatestRun (supabase: SupabaseClient, organizationId: string) {
	const open = await loadOpenRun(supabase, organizationId)
	if (open) return open
	const { data, error } = await supabase
		.from('bling_catalog_sync_runs')
		.select('*')
		.eq('organization_id', organizationId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle()
	if (error) {
		console.error('[bling-catalog-sync] load_latest_run', error.message)
		return null
	}
	return asRun(data)
}

async function insertRun (
	supabase: SupabaseClient,
	params: {
		organizationId: string
		actorUserId: string
		status: RunStatus
		censusDone: boolean
		totalListed: number
	},
) {
	const { data, error } = await supabase
		.from('bling_catalog_sync_runs')
		.insert({
			organization_id: params.organizationId,
			status: params.status,
			census_done: params.censusDone,
			total_listed: params.totalListed,
			started_by: params.actorUserId,
		})
		.select('*')
		.single()
	if (error) {
		if (String(error.code || '') === '23505') {
			return loadOpenRun(supabase, params.organizationId)
		}
		console.error('[bling-catalog-sync] insert_run', error.message)
		return null
	}
	return asRun(data)
}

async function saveRun (
	supabase: SupabaseClient,
	run: RunRow,
	patch: Record<string, unknown>,
	options?: { matchLastPage?: boolean },
) {
	let query = supabase
		.from('bling_catalog_sync_runs')
		.update({ ...patch, updated_at: new Date().toISOString() })
		.eq('id', run.id)
		.eq('organization_id', run.organization_id)
	if (options?.matchLastPage) {
		query = query.eq('last_page', run.last_page)
	}
	const { data, error } = await query.select('*').maybeSingle()
	if (error) {
		console.error('[bling-catalog-sync] save_run', error.message)
		return null
	}
	return asRun(data)
}

export async function readBlingCatalogSync (
	supabase: SupabaseClient,
	organizationId: string,
): Promise<BlingCatalogSyncView> {
	try {
		const run = await loadLatestRun(supabase, organizationId)
		return toView(run, countsFromRun(run))
	} catch (err) {
		console.error('[bling-catalog-sync] read', err)
		const message = blingCatalogSyncErrorMessage(err instanceof Error ? err.message : 'db_error')
		return {
			...emptyBlingCatalogSyncView(),
			ok: false,
			status: 'error',
			message,
			errorMessage: message,
		}
	}
}

async function pauseRun (
	supabase: SupabaseClient,
	run: RunRow,
	counts: ProductCounts,
	err: unknown,
) {
	const errorMessage = clipError(err)
	const saved = await saveRun(supabase, run, {
		status: 'paused',
		error_message: errorMessage,
		failed_count: counts.failed,
	})
	return toView(saved ?? { ...run, status: 'paused', error_message: errorMessage }, counts, {
		advanced: false,
		message: blingCatalogSyncErrorMessage(errorMessage),
	})
}

async function failRun (
	supabase: SupabaseClient,
	run: RunRow,
	counts: ProductCounts,
	err: unknown,
) {
	const errorMessage = clipError(err)
	const saved = await saveRun(supabase, run, {
		status: 'error',
		error_message: errorMessage,
		failed_count: counts.failed,
	})
	return toView(saved ?? { ...run, status: 'error', error_message: errorMessage }, counts, {
		advanced: false,
		message: blingCatalogSyncErrorMessage(errorMessage),
	})
}

async function censusTick (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
	run: RunRow
}): Promise<BlingCatalogSyncView> {
	const { supabase, organizationId, actorUserId, client, run } = params
	if (run.census_done) {
		return toView(run, countsFromRun(run), { advanced: false })
	}

	const page = run.last_page + 1
	let items: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>> = []
	try {
		const data = await client.request<BlingListResponse>({
			method: 'GET',
			path: '/produtos',
			query: { pagina: page, limite: PAGE_SIZE, criterio: 5 },
		})
		const listed = data?.data ?? data?.itens ?? []
		items = Array.isArray(listed) ? listed : []
	} catch (err) {
		const counts = countsFromRun(run)
		if (isRateLimitError(err)) return pauseRun(supabase, run, counts, err)
		return failRun(supabase, run, counts, err)
	}

	let created = 0
	let updated = 0
	let skippedDetail = 0
	const locals = mapBlingCatalogListItems(items)
	for (const local of locals) {
		const blingId = String(local.blingId || '').trim()
		if (!blingId) continue
		try {
			const result = await upsertBlingProductForOrganization({
				supabase,
				organizationId,
				userId: actorUserId,
				local,
				externalReference: `bling:catalog-sync:${blingId}`,
				mode: 'list',
			})
			if (result.action === 'created') created += 1
			else if (result.action === 'updated') updated += 1
			if (result.skippedExistingDetail) skippedDetail += 1
		} catch (err) {
			if (isRateLimitError(err)) {
				return pauseRun(supabase, run, countsFromRun(run), err)
			}
			return failRun(supabase, run, countsFromRun(run), err)
		}
	}

	const reachedEnd = items.length < PAGE_SIZE || page >= MAX_PAGES
	const truncated = page >= MAX_PAGES && items.length >= PAGE_SIZE
	const nextRun: RunRow = {
		...run,
		total_listed: run.total_listed + items.length,
		created_count: run.created_count + created,
		updated_count: run.updated_count + updated,
		skipped_detail_count: run.skipped_detail_count + skippedDetail,
		last_page: page,
		census_done: reachedEnd,
		truncated: run.truncated || truncated,
		error_message: null,
	}
	const counts = countsFromRun(nextRun)
	let status: RunStatus = 'listing'
	if (nextRun.census_done && counts.pendingDetail === 0) status = 'completed'
	else if (nextRun.census_done) status = 'detailing'
	nextRun.status = status

	const saved = await saveRun(supabase, run, {
		status,
		total_listed: nextRun.total_listed,
		created_count: nextRun.created_count,
		updated_count: nextRun.updated_count,
		skipped_detail_count: nextRun.skipped_detail_count,
		failed_count: nextRun.failed_count,
		last_page: page,
		census_done: nextRun.census_done,
		truncated: nextRun.truncated,
		error_message: null,
		finished_at: status === 'completed' ? new Date().toISOString() : null,
	}, { matchLastPage: true })

	if (!saved) {
		const fresh = await loadOpenRun(supabase, organizationId)
		return toView(fresh ?? nextRun, countsFromRun(fresh ?? nextRun), { advanced: true })
	}
	return toView(saved, countsFromRun(saved), { advanced: true })
}

async function fetchDetailLocal (client: BlingRequestClient, blingId: string) {
	const data = await client.request<{ data?: Record<string, unknown> } | Record<string, unknown>>({
		method: 'GET',
		path: blingProdutoApiPath(blingId),
	})
	return mapBlingProductToLocal(data, blingId)
}

async function detailTick (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
	run: RunRow | null
	onlyFailed: boolean
}): Promise<BlingCatalogSyncView> {
	const { supabase, organizationId, actorUserId, client, run, onlyFailed } = params
	let query = supabase
		.from('products')
		.select('id, bling_id')
		.eq('organization_id', organizationId)
		.not('bling_id', 'is', null)
		.neq('bling_id', '')
		.order('created_at', { ascending: true })
		.limit(DETAIL_BATCH)
	query = onlyFailed
		? query.not('bling_detail_error', 'is', null)
		: query.is('bling_detail_synced_at', null).is('bling_detail_error', null)

	const { data, error } = await query
	if (error) {
		console.error('[bling-catalog-sync] detail_query', error.message)
		if (!run) {
			return toView(null, countsFromRun(null), {
				advanced: false,
				message: blingCatalogSyncErrorMessage('db_error'),
			})
		}
		return failRun(supabase, run, countsFromRun(run), error)
	}
	const rows = (Array.isArray(data) ? data : []) as DetailRow[]

	if (rows.length === 0) {
		const counts = countsFromRun(run)
		if (run && run.census_done && !onlyFailed) {
			const saved = await saveRun(supabase, run, {
				status: 'completed',
				failed_count: run.failed_count,
				error_message: null,
				finished_at: new Date().toISOString(),
			})
			const done = saved ?? { ...run, status: 'completed' as const, error_message: null }
			return toView(done, countsFromRun(done), { advanced: false })
		}
		return toView(run, counts, { advanced: false })
	}

	let detailed = 0
	let failedDelta = 0
	for (const row of rows) {
		const blingId = String(row.bling_id || '').trim()
		if (!blingId) continue
		try {
			const local = await fetchDetailLocal(client, blingId)
			const result = await upsertBlingProductForOrganization({
				supabase,
				organizationId,
				userId: actorUserId,
				local: { ...local, blingId },
				externalReference: `bling:catalog-detail:${blingId}`,
				mode: 'full',
			})
			if (result.action === 'invalid') {
				await supabase
					.from('products')
					.update({
						bling_detail_error: 'bling_product_invalid',
						updated_at: new Date().toISOString(),
					})
					.eq('id', row.id)
					.eq('organization_id', organizationId)
				if (!onlyFailed) failedDelta += 1
				continue
			}
			detailed += 1
			if (onlyFailed) failedDelta -= 1
		} catch (err) {
			if (isRateLimitError(err)) {
				if (!run) {
					return toView(null, countsFromRun(null), {
						advanced: false,
						message: blingCatalogSyncErrorMessage(BLING_TOO_MANY_REQUESTS),
					})
				}
				const paused: RunRow = {
					...run,
					status: 'paused',
					error_message: clipError(err),
					detailed_count: run.detailed_count + detailed,
					failed_count: Math.max(0, run.failed_count + failedDelta),
				}
				const saved = await saveRun(supabase, run, {
					status: 'paused',
					error_message: paused.error_message,
					failed_count: paused.failed_count,
					detailed_count: paused.detailed_count,
				})
				return toView(saved ?? paused, countsFromRun(saved ?? paused), {
					advanced: false,
					message: blingCatalogSyncErrorMessage(paused.error_message),
				})
			}
			await supabase
				.from('products')
				.update({
					bling_detail_error: clipError(err),
					updated_at: new Date().toISOString(),
				})
				.eq('id', row.id)
				.eq('organization_id', organizationId)
			if (!onlyFailed) failedDelta += 1
		}
	}

	if (!run) return toView(null, countsFromRun(null), { advanced: true })

	const nextRun: RunRow = {
		...run,
		detailed_count: run.detailed_count + detailed,
		failed_count: Math.max(0, run.failed_count + failedDelta),
		error_message: null,
	}
	const keepListing = !run.census_done
	const status: RunStatus = keepListing ? 'listing' : 'detailing'
	nextRun.status = status
	const saved = await saveRun(supabase, run, {
		status,
		detailed_count: nextRun.detailed_count,
		failed_count: nextRun.failed_count,
		error_message: null,
		finished_at: null,
	})
	return toView(saved ?? nextRun, countsFromRun(saved ?? nextRun), {
		advanced: onlyFailed ? detailed > 0 : true,
	})
}

async function ensureCensusRun (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
}) {
	const open = await loadOpenRun(params.supabase, params.organizationId)
	if (open) return open
	return insertRun(params.supabase, {
		organizationId: params.organizationId,
		actorUserId: params.actorUserId,
		status: 'listing',
		censusDone: false,
		totalListed: 0,
	})
}

export async function advanceBlingCatalogSync (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
	action: BlingCatalogSyncAction
}): Promise<BlingCatalogSyncView> {
	const { supabase, organizationId, actorUserId, client, action } = params

	try {
		if (action === 'retry') {
			const run = await loadOpenRun(supabase, organizationId)
			return detailTick({
				supabase,
				organizationId,
				actorUserId,
				client,
				run,
				onlyFailed: true,
			})
		}

		if (action === 'details') {
			const run = await loadOpenRun(supabase, organizationId)
			return detailTick({
				supabase,
				organizationId,
				actorUserId,
				client,
				run,
				onlyFailed: false,
			})
		}

		const run = await ensureCensusRun({ supabase, organizationId, actorUserId })
		if (!run) {
			return {
				...emptyBlingCatalogSyncView(),
				ok: false,
				status: 'error',
				message: blingCatalogSyncErrorMessage('db_error'),
				errorMessage: 'db_error',
			}
		}

		if (action === 'census' || !run.census_done) {
			return censusTick({ supabase, organizationId, actorUserId, client, run })
		}
		return detailTick({
			supabase,
			organizationId,
			actorUserId,
			client,
			run,
			onlyFailed: false,
		})
	} catch (err) {
		console.error('[bling-catalog-sync] advance', err)
		const open = await loadOpenRun(supabase, organizationId)
		if (open) {
			if (isRateLimitError(err)) return pauseRun(supabase, open, countsFromRun(open), err)
			return failRun(supabase, open, countsFromRun(open), err)
		}
		const message = blingCatalogSyncErrorMessage(err instanceof Error ? err.message : 'sync_failed')
		return {
			...emptyBlingCatalogSyncView(),
			ok: false,
			status: 'error',
			message,
			errorMessage: message,
		}
	}
}

export async function syncBlingCatalogPage (params: {
	supabase: SupabaseClient
	organizationId: string
	actorUserId: string
	client: BlingRequestClient
	page: number
	limit?: number
}): Promise<{ imported: number, updated: number, fetched: number }> {
	const limit = Math.min(Math.max(params.limit ?? PAGE_SIZE, 1), 100)
	const data = await params.client.request<BlingListResponse>({
		method: 'GET',
		path: '/produtos',
		query: { pagina: params.page, limite: limit, criterio: 5 },
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
			mode: 'full',
		})

		if (result.action === 'created') imported += 1
		else if (result.action === 'updated') updated += 1
	}

	return { imported, updated, fetched: items.length }
}
