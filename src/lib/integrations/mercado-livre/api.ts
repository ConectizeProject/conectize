import type { SupabaseClient } from '@supabase/supabase-js'
import {
	MELI_API_BASE_URL,
	MELI_PLATFORM_ID,
} from '@/lib/integrations/mercado-livre/constants'
import { resolveHubSecretsReader } from '@/lib/supabase/hub-secrets'
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
	headers?: Record<string, string>
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
		normalized.includes('invalid_token') ||
		normalized.includes('invalid token') ||
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

	const supabase = resolveHubSecretsReader(
		options?.supabase ?? (await createSupabaseServerClient()),
	)
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
	const orgId = String(organizationId || '').trim()
	if (!orgId) return null
	const { data, error } = await resolveHubSecretsReader(supabase)
		.from('hub_connections')
		.select(
			'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
		)
		.eq('platform_id', MELI_PLATFORM_ID)
		.eq('organization_id', orgId)
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
	const supabaseClient = supabase ?? (await createSupabaseServerClient())
	const current = await refreshMeliTokenIfNeeded(connection, {
		supabase: supabaseClient,
	})
	const token = current.access_token
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
				...(options.headers ?? {}),
			},
			body:
				method === 'GET' || method === 'DELETE'
					? undefined
					: JSON.stringify(options.body ?? {}),
		})
	}

	let res = await send(token)
	if (res.status === 401 && current.refresh_token) {
		const forced = await performMeliTokenRefresh(current, {
			supabase: supabaseClient,
		})
		if (forced.ok === true && forced.connection.access_token) {
			res = await send(forced.connection.access_token)
		} else if (forced.ok === false) {
			throw new Error(forced.error)
		}
	}

	const data = await res.json().catch(() => null)
	if (!res.ok) {
		throw new Error(getMeliErrorMessage(data, res.status))
	}
	return data as T
}

async function meliRequestBinary (
	connection: HubConnection,
	options: MeliRequestOptions,
	supabase?: SupabaseClient,
): Promise<{ bytes: Uint8Array, contentType: string | null }> {
	const supabaseClient = supabase ?? (await createSupabaseServerClient())
	const current = await refreshMeliTokenIfNeeded(connection, {
		supabase: supabaseClient,
	})
	const token = current.access_token
	if (!token) throw new Error('meli_access_token_missing')

	async function send (accessToken: string) {
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
				Accept: '*/*',
				...(options.headers ?? {}),
			},
			body:
				method === 'GET' || method === 'DELETE'
					? undefined
					: JSON.stringify(options.body ?? {}),
		})
	}

	let res = await send(token)
	if (res.status === 401 && current.refresh_token) {
		const forced = await performMeliTokenRefresh(current, {
			supabase: supabaseClient,
		})
		if (forced.ok === true && forced.connection.access_token) {
			res = await send(forced.connection.access_token)
		} else if (forced.ok === false) {
			throw new Error(forced.error)
		}
	}

	if (!res.ok) {
		const data = await res.json().catch(() => null)
		throw new Error(getMeliErrorMessage(data, res.status))
	}

	const buffer = await res.arrayBuffer()
	return {
		bytes: new Uint8Array(buffer),
		contentType: res.headers.get('content-type'),
	}
}

export async function getMeliShipmentLabelsZpl (
	connection: HubConnection,
	shipmentId: string,
	supabase?: SupabaseClient,
): Promise<Uint8Array> {
	const id = String(shipmentId || '').trim()
	if (!id) throw new Error('meli_shipment_id_missing')
	const { bytes } = await meliRequestBinary(
		connection,
		{
			path: '/shipment_labels',
			query: {
				shipment_ids: id,
				response_type: 'zpl2',
			},
		},
		supabase,
	)
	if (!bytes.length) throw new Error('meli_label_empty')
	return bytes
}

export type MeliUserProductDetails = {
	family_id: string | null
	family_name: string | null
	seller_sku: string | null
	stock_locations: unknown
}

export type MeliUserProductFamily = MeliUserProductDetails

function sellerSkuFromMeliPayload(value: unknown): string | null {
	const row =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null
	if (!row) return null
	const attrs = row.attributes
	if (Array.isArray(attrs)) {
		for (const attr of attrs) {
			const entry =
				attr && typeof attr === 'object' && !Array.isArray(attr)
					? (attr as Record<string, unknown>)
					: null
			if (!entry) continue
			if (trimMeliText(entry.id) !== 'SELLER_SKU') continue
			const sku = trimMeliText(entry.value_name) ?? trimMeliText(entry.value_id)
			if (sku) return sku
		}
	}
	return (
		trimMeliText(row.seller_custom_field) ??
		trimMeliText(row.seller_sku) ??
		null
	)
}

function trimMeliText(value: unknown): string | null {
	if (value == null) return null
	const s = String(value).trim()
	return s || null
}

function normalizeMeliFamilyIdValue(value: unknown): string | null {
	const raw = trimMeliText(value)
	if (!raw) return null
	if (/^\d+\.0+$/.test(raw)) return String(Math.trunc(Number(raw)))
	return raw
}

export async function getMeliUserProductDetails(
	connection: HubConnection,
	userProductId: string,
	supabase?: SupabaseClient,
): Promise<MeliUserProductDetails | null> {
	const id = String(userProductId || '').trim()
	if (!id) return null
	try {
		const data = await meliRequestJson<Record<string, unknown>>(
			connection,
			{ path: `/user-products/${encodeURIComponent(id)}` },
			supabase,
		)
		return {
			family_id: normalizeMeliFamilyIdValue(data.family_id),
			family_name: trimMeliText(data.family_name) ?? trimMeliText(data.name),
			seller_sku: sellerSkuFromMeliPayload(data),
			stock_locations: null,
		}
	} catch {
		return null
	}
}

export async function getMeliUserProductStock(
	connection: HubConnection,
	userProductId: string,
	supabase?: SupabaseClient,
): Promise<unknown> {
	const id = String(userProductId || '').trim()
	if (!id) return null
	try {
		const data = await meliRequestJson<Record<string, unknown>>(
			connection,
			{ path: `/user-products/${encodeURIComponent(id)}/stock` },
			supabase,
		)
		return data.locations ?? null
	} catch {
		return null
	}
}

export async function loadMeliUserProductStockById(
	connection: HubConnection,
	userProductIds: string[],
	supabase?: SupabaseClient,
): Promise<Map<string, unknown>> {
	const unique = Array.from(
		new Set(userProductIds.map((id) => String(id).trim()).filter(Boolean)),
	)
	const out = new Map<string, unknown>()
	const concurrency = 8
	let cursor = 0

	async function worker() {
		for (;;) {
			const index = cursor
			cursor += 1
			if (index >= unique.length) return
			const userProductId = unique[index]
			const locations = await getMeliUserProductStock(
				connection,
				userProductId,
				supabase,
			)
			if (locations != null) out.set(userProductId, locations)
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, unique.length) }, () =>
			worker(),
		),
	)
	return out
}

export async function getMeliUserProductFamily(
	connection: HubConnection,
	userProductId: string,
	supabase?: SupabaseClient,
): Promise<MeliUserProductFamily | null> {
	return getMeliUserProductDetails(connection, userProductId, supabase)
}

export async function loadMeliUserProductDetailsById(
	connection: HubConnection,
	userProductIds: string[],
	supabase?: SupabaseClient,
): Promise<Map<string, MeliUserProductDetails>> {
	const unique = Array.from(
		new Set(userProductIds.map((id) => String(id).trim()).filter(Boolean)),
	)
	const out = new Map<string, MeliUserProductDetails>()
	const concurrency = 8
	let cursor = 0

	async function worker() {
		for (;;) {
			const index = cursor
			cursor += 1
			if (index >= unique.length) return
			const userProductId = unique[index]
			const [details, stockLocations] = await Promise.all([
				getMeliUserProductDetails(connection, userProductId, supabase),
				getMeliUserProductStock(connection, userProductId, supabase),
			])
			if (details) {
				out.set(userProductId, {
					...details,
					stock_locations: stockLocations,
				})
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, unique.length) }, () =>
			worker(),
		),
	)
	return out
}

export async function loadMeliFamiliesByUserProductId(
	connection: HubConnection,
	userProductIds: string[],
	supabase?: SupabaseClient,
): Promise<Map<string, MeliUserProductFamily>> {
	return loadMeliUserProductDetailsById(connection, userProductIds, supabase)
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

export type MeliClaimSummary = {
	id: string
	status: 'opened' | 'closed' | null
	type: string | null
}

function parseMeliClaimsPayload (data: unknown): MeliClaimSummary[] {
	const rows = Array.isArray((data as { data?: unknown } | null)?.data)
		? (data as { data: unknown[] }).data
		: Array.isArray((data as { results?: unknown } | null)?.results)
			? (data as { results: unknown[] }).results
			: Array.isArray(data)
				? data
				: []
	return rows
		.map((row) => {
			if (!row || typeof row !== 'object' || Array.isArray(row)) return null
			const claim = row as Record<string, unknown>
			const statusRaw = String(claim.status || '').trim().toLowerCase()
			const status = statusRaw === 'opened' || statusRaw === 'closed'
				? statusRaw
				: null
			return {
				id: String(claim.id || '').trim(),
				status,
				type: String(claim.type || '').trim() || null,
			} satisfies MeliClaimSummary
		})
		.filter((claim): claim is MeliClaimSummary => Boolean(claim?.id))
}

async function searchMeliClaimsByQuery (
	connection: HubConnection,
	query: Record<string, string | number>,
	supabase?: SupabaseClient,
): Promise<MeliClaimSummary[]> {
	// Endpoint oficial: /post-purchase/v1/claims/search
	const primary = await meliRequestJson<{ data?: unknown } | { results?: unknown }>(
		connection,
		{
			path: '/post-purchase/v1/claims/search',
			query,
		},
		supabase,
	).catch(() => null)
	const primaryClaims = parseMeliClaimsPayload(primary)
	if (primaryClaims.length > 0) return primaryClaims

	// Fallback legado (alguns ambientes ainda respondem em /v1).
	const legacy = await meliRequestJson<{ data?: unknown } | { results?: unknown }>(
		connection,
		{
			path: '/v1/claims/search',
			query,
		},
		supabase,
	).catch(() => null)
	return parseMeliClaimsPayload(legacy)
}

/** Busca reclamações/mediações vinculadas ao pedido (e ao pack, se informado). */
export async function searchMeliClaimsByOrderId(
	connection: HubConnection,
	orderId: string,
	supabase?: SupabaseClient,
	options?: { packId?: string | null },
): Promise<MeliClaimSummary[]> {
	const id = String(orderId || '').trim()
	if (!id) return []
	const byOrder = await searchMeliClaimsByQuery(
		connection,
		{ order_id: id, limit: 10 },
		supabase,
	)
	if (byOrder.length > 0) return byOrder

	const packId = String(options?.packId || '').trim()
	if (!packId || packId === id) return []
	return searchMeliClaimsByQuery(
		connection,
		{ pack_id: packId, limit: 10 },
		supabase,
	)
}

/** Escolhe a reclamação mais relevante para exibir (mediação aberta > mediação fechada > demais). */
export function pickMeliClaimForDisplay (
	claims: MeliClaimSummary[],
): MeliClaimSummary | null {
	if (!Array.isArray(claims) || claims.length === 0) return null
	const mediations = claims.filter((item) => item.type === 'mediations')
	const pool = mediations.length > 0 ? mediations : claims
	return pool.find((item) => item.status === 'opened')
		|| pool.find((item) => item.status === 'closed')
		|| pool[0]
		|| null
}

export type MeliOrdersSearchPage = {
	results?: unknown
	paging?: {
		total?: number
		offset?: number
		limit?: number
	}
}

export async function searchMeliOrdersByCreatedAt(
	connection: HubConnection,
	params: {
		sellerId: string
		from: string
		to: string
		status: string
		offset: number
		limit: number
	},
	supabase?: SupabaseClient,
): Promise<MeliOrdersSearchPage> {
	const sellerId = String(params.sellerId || '').trim()
	if (!sellerId) throw new Error('meli_user_id_missing')
	return meliRequestJson<MeliOrdersSearchPage>(
		connection,
		{
			path: '/orders/search',
			query: {
				seller: sellerId,
				'order.date_created.from': params.from,
				'order.date_created.to': params.to,
				'order.status': params.status,
				sort: 'date_desc',
				offset: params.offset,
				limit: params.limit,
			},
		},
		supabase,
	)
}

export async function getMeliShipment(
	connection: HubConnection,
	shipmentId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(shipmentId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{
			path: `/shipments/${id}`,
			headers: { 'x-format-new': 'true' },
		},
		supabase,
	)
}

export async function getMeliShipmentCosts(
	connection: HubConnection,
	shipmentId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(shipmentId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{
			path: `/shipments/${id}/costs`,
			headers: { 'x-format-new': 'true' },
		},
		supabase,
	)
}

export async function getMeliShipmentSla(
	connection: HubConnection,
	shipmentId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(shipmentId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{ path: `/shipments/${id}/sla` },
		supabase,
	)
}

export async function getMeliItem(
	connection: HubConnection,
	itemId: string,
	supabase?: SupabaseClient,
	options?: { includeAttributes?: boolean },
): Promise<Record<string, unknown>> {
	const id = encodeURIComponent(String(itemId).trim())
	return meliRequestJson<Record<string, unknown>>(
		connection,
		{
			path: `/items/${id}`,
			...(options?.includeAttributes
				? { query: { include_attributes: 'all' } }
				: {}),
		},
		supabase,
	)
}

export async function getMeliItemPrices(
	connection: HubConnection,
	itemId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown> | null> {
	const id = encodeURIComponent(String(itemId).trim())
	if (!id) return null
	try {
		return await meliRequestJson<Record<string, unknown>>(
			connection,
			{ path: `/items/${id}/prices` },
			supabase,
		)
	} catch {
		return null
	}
}

export async function getMeliItemDescription(
	connection: HubConnection,
	itemId: string,
	supabase?: SupabaseClient,
): Promise<Record<string, unknown> | null> {
	const id = encodeURIComponent(String(itemId).trim())
	if (!id) return null
	try {
		return await meliRequestJson<Record<string, unknown>>(
			connection,
			{ path: `/items/${id}/description` },
			supabase,
		)
	} catch {
		return null
	}
}

export type MeliItemMetadataExtras = {
	pricesPayload: Record<string, unknown> | null
	descriptionPayload: Record<string, unknown> | null
}

export async function loadMeliItemMetadataById(
	connection: HubConnection,
	itemIds: string[],
	supabase?: SupabaseClient,
): Promise<Map<string, MeliItemMetadataExtras>> {
	const unique = Array.from(
		new Set(itemIds.map((id) => String(id).trim()).filter(Boolean)),
	)
	const out = new Map<string, MeliItemMetadataExtras>()
	const concurrency = 6
	let cursor = 0

	async function worker() {
		for (;;) {
			const index = cursor
			cursor += 1
			if (index >= unique.length) return
			const itemId = unique[index]
			const [pricesPayload, descriptionPayload] = await Promise.all([
				getMeliItemPrices(connection, itemId, supabase),
				getMeliItemDescription(connection, itemId, supabase),
			])
			out.set(itemId, { pricesPayload, descriptionPayload })
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, unique.length) }, () =>
			worker(),
		),
	)
	return out
}

export async function loadMeliItemsWithAttributes(
	connection: HubConnection,
	itemIds: string[],
	supabase?: SupabaseClient,
): Promise<Map<string, Record<string, unknown>>> {
	const unique = Array.from(
		new Set(itemIds.map((id) => String(id).trim()).filter(Boolean)),
	)
	const out = new Map<string, Record<string, unknown>>()
	const concurrency = 8
	let cursor = 0

	async function worker() {
		for (;;) {
			const index = cursor
			cursor += 1
			if (index >= unique.length) return
			const itemId = unique[index]
			try {
				const item = await getMeliItem(connection, itemId, supabase, {
					includeAttributes: true,
				})
				out.set(itemId, item)
			} catch {
				// ignora falha pontual de enriquecimento
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(concurrency, unique.length) }, () =>
			worker(),
		),
	)
	return out
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

export type MeliInvoiceSummary = {
	id: string
	status: string | null
	authorized: boolean
	danfeLocation: string | null
	xmlLocation: string | null
}

function meliSellerIdFromConnection (connection: HubConnection): string | null {
	const raw = connection.metadata?.user_id
	if (raw == null) return null
	const sellerId = String(raw).trim()
	return sellerId || null
}

function asInvoiceRecord (value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return value as Record<string, unknown>
}

function normalizeInvoicePath (value: unknown): string | null {
	const raw = String(value || '').trim()
	if (!raw) return null
	if (raw.startsWith('/')) return raw
	try {
		const url = new URL(raw)
		if (!url.pathname) return null
		return `${url.pathname}${url.search}`
	} catch {
		return null
	}
}

function parseMeliInvoicePayload (payload: unknown): MeliInvoiceSummary | null {
	const candidates: unknown[] = []
	if (Array.isArray(payload)) {
		candidates.push(...payload)
	} else {
		const root = asInvoiceRecord(payload)
		if (!root) return null
		if (root.id != null || root.attributes != null || root.status != null) {
			candidates.push(root)
		}
		const nested = root.invoice ?? root.data ?? root.result
		if (Array.isArray(nested)) candidates.push(...nested)
		else if (nested) candidates.push(nested)
		const list = root.invoices
		if (Array.isArray(list)) candidates.push(...list)
	}

	for (const entry of candidates) {
		const row = asInvoiceRecord(entry)
		if (!row) continue
		const attributes = asInvoiceRecord(row.attributes) ?? {}
		const id = String(row.id || attributes.invoice_id || '').trim()
		if (!id) continue
		const statusRaw = String(
			row.status
			|| row.transaction_status
			|| attributes.status
			|| '',
		).trim().toLowerCase()
		const authorized = statusRaw === 'authorized'
		const danfeLocation = normalizeInvoicePath(
			attributes.danfe_location ?? attributes.danfe ?? row.danfe_location ?? row.danfe,
		)
		const xmlLocation = normalizeInvoicePath(
			attributes.xml_location ?? attributes.document ?? row.xml_location ?? row.document,
		)
		return {
			id,
			status: statusRaw || null,
			authorized,
			danfeLocation,
			xmlLocation,
		}
	}
	return null
}

export async function getMeliInvoiceByOrderId (
	connection: HubConnection,
	orderId: string,
	supabase?: SupabaseClient,
): Promise<MeliInvoiceSummary | null> {
	const sellerId = meliSellerIdFromConnection(connection)
	const id = String(orderId || '').trim()
	if (!sellerId || !id) return null
	const data = await meliRequestJson<unknown>(
		connection,
		{
			path: `/users/${encodeURIComponent(sellerId)}/invoices/orders/${encodeURIComponent(id)}`,
		},
		supabase,
	).catch(() => null)
	return parseMeliInvoicePayload(data)
}

export async function getMeliInvoiceByShipmentId (
	connection: HubConnection,
	shipmentId: string,
	supabase?: SupabaseClient,
): Promise<MeliInvoiceSummary | null> {
	const sellerId = meliSellerIdFromConnection(connection)
	const id = String(shipmentId || '').trim()
	if (!sellerId || !id) return null
	const data = await meliRequestJson<unknown>(
		connection,
		{
			path: `/users/${encodeURIComponent(sellerId)}/invoices/shipments/${encodeURIComponent(id)}`,
		},
		supabase,
	).catch(() => null)
	return parseMeliInvoicePayload(data)
}

export async function resolveMeliSaleInvoice (params: {
	connection: HubConnection
	mlOrderId?: string | null
	mlShipmentId?: string | null
	supabase?: SupabaseClient
}): Promise<MeliInvoiceSummary | null> {
	const orderId = String(params.mlOrderId || '').trim()
	if (orderId) {
		const byOrder = await getMeliInvoiceByOrderId(
			params.connection,
			orderId,
			params.supabase,
		)
		if (byOrder) return byOrder
	}
	const shipmentId = String(params.mlShipmentId || '').trim()
	if (shipmentId) {
		return getMeliInvoiceByShipmentId(
			params.connection,
			shipmentId,
			params.supabase,
		)
	}
	return null
}

export async function getMeliInvoiceDocumentBinary (
	connection: HubConnection,
	documentPath: string,
	supabase?: SupabaseClient,
): Promise<{ bytes: Uint8Array, contentType: string | null }> {
	const path = normalizeInvoicePath(documentPath)
	if (!path) throw new Error('meli_invoice_path_missing')
	return meliRequestBinary(
		connection,
		{ path },
		supabase,
	)
}

/** Busca NF-e autorizada no emissor do MELI (ex.: vendas FULL). */
export async function withLiveMeliInvoices<T extends {
	id: string
	ml_order_id?: string | null
	ml_shipment_id?: string | null
	ml_logistic_type?: string | null
}> (params: {
	supabase: SupabaseClient
	organizationId: string
	orders: T[]
}): Promise<Map<string, MeliInvoiceSummary>> {
	const out = new Map<string, MeliInvoiceSummary>()
	const pending = params.orders.filter((order) => {
		const logistic = String(order.ml_logistic_type || '').trim().toLowerCase()
		return logistic === 'fulfillment' && Boolean(String(order.ml_order_id || '').trim() || String(order.ml_shipment_id || '').trim())
	})
	if (pending.length === 0) return out

	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) return out

	const concurrency = 4
	for (let index = 0; index < pending.length; index += concurrency) {
		const batch = pending.slice(index, index + concurrency)
		const results = await Promise.all(
			batch.map(async (order) => {
				const invoice = await resolveMeliSaleInvoice({
					connection,
					mlOrderId: order.ml_order_id,
					mlShipmentId: order.ml_shipment_id,
					supabase: params.supabase,
				})
				return { orderId: order.id, invoice }
			}),
		)
		for (const row of results) {
			if (row.invoice) out.set(row.orderId, row.invoice)
		}
	}
	return out
}
