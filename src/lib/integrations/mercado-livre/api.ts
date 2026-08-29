import type { SupabaseClient } from '@supabase/supabase-js'
import {
	MELI_API_BASE_URL,
	MELI_PLATFORM_ID,
} from '@/lib/integrations/mercado-livre/constants'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type HubConnection = {
	id: string
	platform_id: string
	access_token: string | null
	refresh_token: string | null
	token_expires_at: string | null
	metadata: Record<string, unknown> | null
	created_by: string | null
}

type MeliTokenResponse = {
	access_token?: string
	refresh_token?: string
	expires_in?: number
	token_type?: string
	scope?: string
	user_id?: number | string
	error?: string
	error_description?: string
	message?: string
}

type PerformMeliTokenRefreshOptions = {
	supabase?: SupabaseClient
}

type MeliTokenRefreshResult =
	| { ok: true; connection: HubConnection }
	| { ok: false; error: string }

type MeliRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	path: string
	query?: Record<string, string | number | boolean | undefined | null>
	body?: unknown
}

export type MeliUserMe = {
	id: number | string
	nickname?: string | null
	email?: string | null
	first_name?: string | null
	last_name?: string | null
	site_id?: string | null
}

function stringifyMeliErrorValue(value: unknown): string | null {
	if (typeof value === 'string') {
		const normalized = value.trim()
		return normalized || null
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	if (!value || typeof value !== 'object') return null
	if (Array.isArray(value)) {
		const items = value
			.map((item) => stringifyMeliErrorValue(item))
			.filter((item): item is string => Boolean(item))
		return items.length > 0 ? items.join(', ') : null
	}
	const objectValue = value as Record<string, unknown>
	const preferred = ['message', 'error_description', 'error', 'detail']
		.map((key) => stringifyMeliErrorValue(objectValue[key]))
		.filter((item): item is string => Boolean(item))
	if (preferred.length > 0) return preferred.join(' | ')
	try {
		return JSON.stringify(objectValue)
	} catch {
		return null
	}
}

function getMeliErrorMessage(data: unknown, status: number) {
	return stringifyMeliErrorValue(data) || `meli_request_failed_${status}`
}

function getProactiveRefreshMarginMs(): number {
	const raw = process.env.MELI_ACCESS_TOKEN_REFRESH_MARGIN_MINUTES
	if (raw != null && raw !== '') {
		const n = Number(raw)
		if (Number.isFinite(n) && n >= 0) return Math.round(n * 60_000)
	}
	return 30 * 60_000
}

export function shouldRefreshMeliAccessToken(
	expiresAt: string | null,
	marginMs?: number,
): boolean {
	const margin = marginMs ?? getProactiveRefreshMarginMs()
	if (!expiresAt) return true
	const expiry = Date.parse(expiresAt)
	if (Number.isNaN(expiry)) return true
	return expiry <= Date.now() + margin
}

function isInvalidGrantRefreshError(error: string) {
	const normalized = String(error || '').toLowerCase()
	return (
		normalized.includes('invalid_grant') ||
		normalized.includes('invalid refresh token')
	)
}

async function setMeliReconnectRequired(
	supabase: SupabaseClient,
	connection: HubConnection,
	error: string,
) {
	const previousMetadata =
		connection.metadata && typeof connection.metadata === 'object'
			? connection.metadata
			: {}

	await supabase
		.from('hub_connections')
		.update({
			metadata: {
				...previousMetadata,
				meliReconnectRequired: true,
				meliReconnectReason: 'invalid_grant',
				meliReconnectAt: new Date().toISOString(),
				meliLastRefreshError: error,
			},
			updated_at: new Date().toISOString(),
		})
		.eq('id', connection.id)
}

async function requestMeliTokenRefresh(refreshToken: string) {
	const clientId = process.env.MELI_CLIENT_ID
	const clientSecret = process.env.MELI_CLIENT_SECRET
	if (!clientId || !clientSecret) {
		return { ok: false as const, error: 'meli_oauth_not_configured' }
	}

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
	})

	const res = await fetch(`${MELI_API_BASE_URL}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})

	const data = (await res.json().catch(() => null)) as MeliTokenResponse | null
	if (!res.ok || !data?.access_token) {
		const errMsg = getMeliErrorMessage(data, res.status)
		return {
			ok: false as const,
			error: `refresh_failed_http_${res.status}: ${errMsg}`,
		}
	}

	return { ok: true as const, data }
}

function mergeMeliTokenMetadata(
	previous: Record<string, unknown>,
	tokenData: MeliTokenResponse,
): Record<string, unknown> {
	const userId =
		tokenData.user_id != null ? String(tokenData.user_id) : previous.user_id
	return {
		...previous,
		user_id: userId != null ? String(userId) : (previous.user_id ?? null),
		scope: tokenData.scope || previous.scope || null,
		meliReconnectRequired: false,
		meliReconnectReason: null,
		meliReconnectAt: null,
		meliLastRefreshError: null,
	}
}

/**
 * Renova o access token no Mercado Livre. O refresh_token é de uso único:
 * sempre persistir o **novo** valor retornado.
 */
export async function performMeliTokenRefresh(
	connection: HubConnection,
	options?: PerformMeliTokenRefreshOptions,
): Promise<MeliTokenRefreshResult> {
	if (!connection.refresh_token) {
		return { ok: false, error: 'no_refresh_token' }
	}

	const supabase = options?.supabase ?? (await createSupabaseServerClient())
	const firstAttempt = await requestMeliTokenRefresh(connection.refresh_token)

	let sourceConnection = connection
	let tokenData: MeliTokenResponse | null = null

	if (firstAttempt.ok) {
		tokenData = firstAttempt.data
	} else {
		const looksLikeInvalidGrant = isInvalidGrantRefreshError(firstAttempt.error)
		if (!looksLikeInvalidGrant) {
			return { ok: false, error: firstAttempt.error }
		}

		const { data: latest, error: latestError } = await supabase
			.from('hub_connections')
			.select(
				'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
			)
			.eq('id', connection.id)
			.maybeSingle()

		if (latestError || !latest) {
			await setMeliReconnectRequired(supabase, connection, firstAttempt.error)
			return { ok: false, error: firstAttempt.error }
		}

		const latestConnection = latest as HubConnection
		if (
			!latestConnection.refresh_token ||
			latestConnection.refresh_token === connection.refresh_token
		) {
			await setMeliReconnectRequired(
				supabase,
				latestConnection,
				firstAttempt.error,
			)
			return { ok: false, error: firstAttempt.error }
		}

		const retryAttempt = await requestMeliTokenRefresh(
			latestConnection.refresh_token,
		)
		if (!retryAttempt.ok) {
			if (isInvalidGrantRefreshError(retryAttempt.error)) {
				await setMeliReconnectRequired(
					supabase,
					latestConnection,
					retryAttempt.error,
				)
			}
			return { ok: false, error: retryAttempt.error }
		}

		sourceConnection = latestConnection
		tokenData = retryAttempt.data
	}

	if (!tokenData?.access_token) {
		return { ok: false, error: 'refresh_failed_no_access_token' }
	}

	if (!tokenData.refresh_token) {
		return { ok: false, error: 'refresh_failed_no_refresh_token' }
	}

	const expiresIn = Number(tokenData.expires_in) || 21600
	const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
	const previousMetadata =
		sourceConnection.metadata && typeof sourceConnection.metadata === 'object'
			? (sourceConnection.metadata as Record<string, unknown>)
			: {}

	const { data: updated, error: updateError } = await supabase
		.from('hub_connections')
		.update({
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token,
			token_expires_at: tokenExpiresAt,
			metadata: mergeMeliTokenMetadata(previousMetadata, tokenData),
			updated_at: new Date().toISOString(),
		})
		.eq('id', connection.id)
		.eq('refresh_token', sourceConnection.refresh_token)
		.select(
			'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
		)
		.maybeSingle()

	if (updateError) {
		return {
			ok: false,
			error: `db_update_failed: ${updateError.message || 'unknown'}`,
		}
	}

	if (!updated) {
		const { data: latest } = await supabase
			.from('hub_connections')
			.select(
				'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
			)
			.eq('id', connection.id)
			.maybeSingle()

		if (latest) {
			return { ok: true, connection: latest as HubConnection }
		}
		return { ok: false, error: 'db_update_failed' }
	}

	return { ok: true, connection: updated as HubConnection }
}

export async function refreshMeliTokenIfNeeded(
	connection: HubConnection,
	options?: PerformMeliTokenRefreshOptions,
) {
	if (
		!connection.refresh_token ||
		!shouldRefreshMeliAccessToken(connection.token_expires_at)
	) {
		return connection
	}

	const result = await performMeliTokenRefresh(connection, options)
	return result.ok ? result.connection : connection
}

export async function forceRefreshMeliToken(
	connection: HubConnection,
	options?: PerformMeliTokenRefreshOptions,
): Promise<MeliTokenRefreshResult> {
	return performMeliTokenRefresh(connection, options)
}

export async function getMeliConnectionByOrganizationId(
	supabase: SupabaseClient,
	organizationId: string,
): Promise<HubConnection | null> {
	const { data, error } = await supabase
		.from('hub_connections')
		.select(
			'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
		)
		.eq('platform_id', MELI_PLATFORM_ID)
		.eq('organization_id', organizationId)
		.order('updated_at', { ascending: false })
		.limit(1)
		.maybeSingle()

	if (error || !data) return null
	return data as HubConnection
}

async function meliRequestJson<T>(
	connection: HubConnection,
	options: MeliRequestOptions,
	supabase?: SupabaseClient,
): Promise<T> {
	const refreshed = await refreshMeliTokenIfNeeded(connection, { supabase })
	const token = refreshed.access_token
	if (!token) throw new Error('meli_access_token_missing')

	async function send(accessToken: string) {
		const method = options.method || 'GET'
		const url = new URL(`${MELI_API_BASE_URL}${options.path}`)
		if (options.query) {
			for (const [key, value] of Object.entries(options.query)) {
				if (value === undefined || value === null) continue
				url.searchParams.set(key, String(value))
			}
		}

		return fetch(url.toString(), {
			method,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
				...(method === 'GET' || method === 'DELETE'
					? {}
					: { 'Content-Type': 'application/json' }),
			},
			body:
				method === 'GET' || method === 'DELETE'
					? undefined
					: JSON.stringify(options.body ?? {}),
		})
	}

	let res = await send(token)
	if (res.status === 401 && refreshed.refresh_token && supabase) {
		const forced = await performMeliTokenRefresh(refreshed, { supabase })
		if (forced.ok && forced.connection.access_token) {
			res = await send(forced.connection.access_token)
		}
	}

	const data = await res.json().catch(() => null)
	if (!res.ok) {
		throw new Error(getMeliErrorMessage(data, res.status))
	}
	return data as T
}

export async function getMeliUserMe(
	accessToken: string,
): Promise<MeliUserMe | null> {
	const res = await fetch(`${MELI_API_BASE_URL}/users/me`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
		},
	})
	const data = await res.json().catch(() => null)
	if (!res.ok || !data || typeof data !== 'object') return null
	return data as MeliUserMe
}

export async function getMeliOrder(
	connection: HubConnection,
	orderId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(orderId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{
			path: `/orders/${id}`,
		},
		supabase,
	)
}

export async function getMeliItem(
	connection: HubConnection,
	itemId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(itemId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{
			path: `/items/${id}`,
		},
		supabase,
	)
}

type MeliItemsSearchResponse = {
	results?: unknown
	scroll_id?: string | null
	paging?: {
		total?: number
		offset?: number
		limit?: number
	}
}

const MELI_SEARCH_PAGE_LIMIT = 50
const MELI_SCAN_PAGE_LIMIT = 100
const MELI_MAX_ITEM_IDS = 5000
const MELI_MULTIGET_BATCH = 20

function normalizeItemIdList(results: unknown): string[] {
	if (!Array.isArray(results)) return []
	const ids: string[] = []
	for (const row of results) {
		if (typeof row === 'string' || typeof row === 'number') {
			const id = String(row).trim()
			if (id) ids.push(id)
			continue
		}
		if (row && typeof row === 'object' && 'id' in row) {
			const id = String((row as { id: unknown }).id ?? '').trim()
			if (id) ids.push(id)
		}
	}
	return ids
}

/**
 * Lista todos os IDs de anúncios do seller.
 * Usa offset/limit até 1000; acima disso usa search_type=scan + scroll_id.
 */
export async function searchSellerItemIds(
	connection: HubConnection,
	userId: string,
	supabase?: SupabaseClient,
): Promise<string[]> {
	const uid = encodeURIComponent(String(userId).trim())
	if (!uid) throw new Error('meli_user_id_missing')

	const first = await meliRequestJson<MeliItemsSearchResponse>(
		connection,
		{
			path: `/users/${uid}/items/search`,
			query: { limit: MELI_SEARCH_PAGE_LIMIT, offset: 0 },
		},
		supabase,
	)

	const total = Number(first.paging?.total)
	const useScan = Number.isFinite(total) && total > 1000

	if (!useScan) {
		const all = normalizeItemIdList(first.results)
		let offset = MELI_SEARCH_PAGE_LIMIT
		while (
			all.length < (Number.isFinite(total) ? total : Number.POSITIVE_INFINITY)
		) {
			if (all.length >= MELI_MAX_ITEM_IDS) break
			const page = await meliRequestJson<MeliItemsSearchResponse>(
				connection,
				{
					path: `/users/${uid}/items/search`,
					query: { limit: MELI_SEARCH_PAGE_LIMIT, offset },
				},
				supabase,
			)
			const chunk = normalizeItemIdList(page.results)
			if (chunk.length === 0) break
			all.push(...chunk)
			offset += MELI_SEARCH_PAGE_LIMIT
			if (!Number.isFinite(total) && chunk.length < MELI_SEARCH_PAGE_LIMIT)
				break
		}
		return Array.from(new Set(all)).slice(0, MELI_MAX_ITEM_IDS)
	}

	const all: string[] = []
	let scrollId: string | null = null
	for (;;) {
		if (all.length >= MELI_MAX_ITEM_IDS) break
		const page = await meliRequestJson<MeliItemsSearchResponse>(
			connection,
			{
				path: `/users/${uid}/items/search`,
				query: {
					search_type: 'scan',
					limit: MELI_SCAN_PAGE_LIMIT,
					...(scrollId ? { scroll_id: scrollId } : {}),
				},
			},
			supabase,
		)
		const chunk = normalizeItemIdList(page.results)
		if (chunk.length === 0) break
		all.push(...chunk)
		scrollId =
			typeof page.scroll_id === 'string' && page.scroll_id.trim()
				? page.scroll_id.trim()
				: null
		if (!scrollId) break
	}
	return Array.from(new Set(all)).slice(0, MELI_MAX_ITEM_IDS)
}

type MeliMultigetRow = {
	code?: number
	body?: Record<string, unknown>
}

/**
 * Multiget de itens (`GET /items?ids=`), em lotes de até 20.
 * Retorna só bodies com HTTP 200.
 */
export async function getMeliItemsMultiget(
	connection: HubConnection,
	itemIds: string[],
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>[]> {
	const unique = Array.from(
		new Set(itemIds.map((id) => String(id).trim()).filter(Boolean)),
	)
	const out: Record<string, unknown>[] = []

	for (let i = 0; i < unique.length; i += MELI_MULTIGET_BATCH) {
		const batch = unique.slice(i, i + MELI_MULTIGET_BATCH)
		const data = await meliRequestJson<
			MeliMultigetRow[] | Record<string, unknown>
		>(
			connection,
			{
				path: '/items',
				query: { ids: batch.join(',') },
			},
			supabase,
		)

		if (Array.isArray(data)) {
			for (const row of data) {
				if (
					row &&
					typeof row === 'object' &&
					row.body &&
					(row.code == null || row.code === 200)
				) {
					out.push(row.body)
				}
			}
			continue
		}

		// Alguns ambientes devolvem um único objeto quando ids=1
		if (data && typeof data === 'object' && 'id' in data) {
			out.push(data as Record<string, unknown>)
		}
	}

	return out
}
