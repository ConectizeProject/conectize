import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import {
	enrichListItemsWithDetails,
	type BlingListResponse,
	type BlingRequestClient,
	type MappedLocal,
	upsertBlingProductForOrganization,
} from '@/lib/integrations/bling/product-upsert'

type SyncResultRow = {
	sku: string
	action: 'created' | 'updated' | 'not_found' | 'invalid'
	productId?: string
	productName?: string
}

function normalizeSku (value: string) {
	return String(value || '').trim().toLowerCase()
}

/** Compara GTINs ignorando espaços e caracteres não numéricos. */
function normalizeGtin (value: string) {
	return String(value || '').replace(/\D/g, '')
}

function parseUniqueTokens (
	values: unknown[],
	normalize: (value: string) => string,
	max = 50,
): string[] {
	const seen = new Set<string>()
	const unique: string[] = []
	for (const raw of values) {
		const token = String(raw ?? '').trim()
		const key = normalize(token)
		if (!key || seen.has(key)) continue
		seen.add(key)
		unique.push(token)
		if (unique.length >= max) break
	}
	return unique
}

function parseSkusFromBody (body: { skus?: unknown; query?: unknown } | null): string[] {
	const fromArray = Array.isArray(body?.skus)
		? body.skus.map((item) => String(item ?? '').trim()).filter(Boolean)
		: []
	const fromQuery = String(body?.query ?? '')
		.split(/[,;\n]+/)
		.map((item) => item.trim())
		.filter(Boolean)
	return parseUniqueTokens([...fromArray, ...fromQuery], normalizeSku)
}

function parseGtinsFromBody (body: { gtins?: unknown; gtin?: unknown } | null): string[] {
	const fromArray = Array.isArray(body?.gtins)
		? body.gtins.map((item) => String(item ?? '').trim()).filter(Boolean)
		: []
	const fromSingle = String(body?.gtin ?? '').trim()
	const merged = fromSingle ? [...fromArray, fromSingle] : fromArray
	return parseUniqueTokens(merged, normalizeGtin)
}

async function findBlingProductsBySkus (
	client: BlingRequestClient,
	skus: string[],
) {
	const query: Record<string, string | number | string[]> = {
		pagina: 1,
		limite: Math.min(100, Math.max(50, skus.length)),
		criterio: 5,
	}
	if (skus.length === 1) {
		query.codigo = skus[0]
	} else {
		query.codigos = skus
	}

	const data = await client.request<BlingListResponse>({
		method: 'GET',
		path: '/produtos',
		query,
	})
	const items = data?.data ?? data?.itens ?? []
	if (!Array.isArray(items) || items.length === 0) {
		return []
	}
	return enrichListItemsWithDetails(client, items)
}

async function findBlingProductsByGtins (
	client: BlingRequestClient,
	gtins: string[],
) {
	const data = await client.request<BlingListResponse>({
		method: 'GET',
		path: '/produtos',
		query: {
			pagina: 1,
			limite: Math.min(100, Math.max(50, gtins.length)),
			criterio: 5,
			gtins,
		},
	})
	const items = data?.data ?? data?.itens ?? []
	if (!Array.isArray(items) || items.length === 0) {
		return []
	}
	return enrichListItemsWithDetails(client, items)
}

function collectGtinKeys (local: MappedLocal, dto: Record<string, unknown>): string[] {
	const keys = new Set<string>()
	for (const value of [local.barcode, dto.gtin, dto.gtinEmbalagem, dto.codigoBarras]) {
		const key = normalizeGtin(String(value ?? ''))
		if (key) keys.add(key)
	}
	return [...keys]
}

function describeLookupFilter (skus: string[], gtins: string[]): string {
	const parts: string[] = []
	if (skus.length === 1) parts.push('codigo')
	else if (skus.length > 1) parts.push('codigos')
	if (gtins.length > 0) parts.push('gtins')
	return parts.join('+') || 'none'
}

/** criterio=1 = últimos incluídos (Bling). */
async function findBlingLatestCreatedProducts (
	client: BlingRequestClient,
	limit = 50,
) {
	const data = await client.request<BlingListResponse>({
		method: 'GET',
		path: '/produtos',
		query: {
			pagina: 1,
			limite: Math.min(100, Math.max(1, limit)),
			criterio: 1,
		},
	})
	const items = data?.data ?? data?.itens ?? []
	if (!Array.isArray(items) || items.length === 0) {
		return []
	}
	return enrichListItemsWithDetails(client, items)
}

async function upsertSyncedProduct (params: {
	supabase: SupabaseClient
	organizationId: string
	userId: string
	local: MappedLocal
	skuQuery: string
}): Promise<SyncResultRow> {
	const result = await upsertBlingProductForOrganization({
		supabase: params.supabase,
		organizationId: params.organizationId,
		userId: params.userId,
		local: params.local,
		externalReference: `hub:search-sync:sku:${params.skuQuery}`,
	})

	if (result.action === 'invalid') {
		return { sku: params.skuQuery, action: 'invalid' }
	}

	return {
		sku: params.skuQuery,
		action: result.action,
		productId: result.productId,
		productName: result.productName,
	}
}

export async function POST (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}

	const body = await request.json().catch(() => null) as {
		skus?: unknown
		query?: unknown
		gtins?: unknown
		gtin?: unknown
		mode?: unknown
		limit?: unknown
	} | null
	const mode = body?.mode === 'latest' ? 'latest' : 'lookup'
	const skus = mode === 'lookup' ? parseSkusFromBody(body) : []
	const gtins = mode === 'lookup' ? parseGtinsFromBody(body) : []
	const latestLimitRaw = Number(body?.limit)
	const latestLimit = Number.isFinite(latestLimitRaw) && latestLimitRaw > 0
		? Math.min(100, Math.floor(latestLimitRaw))
		: 50

	if (mode === 'lookup' && skus.length === 0 && gtins.length === 0) {
		return NextResponse.json({ ok: false, error: 'query_required' }, { status: 400 })
	}

	const clientRes = await getBlingClientForCurrentUser()
	if (!clientRes.ok || !('client' in clientRes)) {
		const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
		return NextResponse.json({ ok: false, error }, { status: 400 })
	}

	try {
		const results: SyncResultRow[] = []
		const upsertedBlingIds = new Set<string>()

		if (mode === 'latest') {
			const foundItems = await findBlingLatestCreatedProducts(clientRes.client, latestLimit)
			if (foundItems.length === 0) {
				return NextResponse.json({
					ok: false,
					error: 'product_not_found',
					results: [],
					created: 0,
					updated: 0,
					notFound: 0,
					filter: 'criterio:1',
				}, { status: 404 })
			}

			for (const item of foundItems) {
				const blingId = String(item.local.blingId || '').trim()
				if (blingId) {
					if (upsertedBlingIds.has(blingId)) continue
					upsertedBlingIds.add(blingId)
				}
				const skuLabel = String(item.local.sku || item.local.name || blingId || 'sem-sku').trim()
				results.push(
					await upsertSyncedProduct({
						supabase: auth.supabase,
						organizationId: auth.organizationId,
						userId: auth.userId,
						local: item.local,
						skuQuery: skuLabel,
					}),
				)
			}
		} else {
			if (skus.length > 0) {
				const foundItems = await findBlingProductsBySkus(clientRes.client, skus)
				const bySku = new Map<string, { dto: Record<string, unknown>; local: MappedLocal }>()
				for (const item of foundItems) {
					const key = normalizeSku(item.local.sku || '')
					if (key && !bySku.has(key)) bySku.set(key, item)
				}

				for (const sku of skus) {
					const match = bySku.get(normalizeSku(sku))
					if (!match) {
						results.push({ sku, action: 'not_found' })
						continue
					}
					const blingId = String(match.local.blingId || '').trim()
					if (blingId && upsertedBlingIds.has(blingId)) continue
					if (blingId) upsertedBlingIds.add(blingId)
					results.push(
						await upsertSyncedProduct({
							supabase: auth.supabase,
							organizationId: auth.organizationId,
							userId: auth.userId,
							local: match.local,
							skuQuery: sku,
						}),
					)
				}
			}

			if (gtins.length > 0) {
				const foundItems = await findBlingProductsByGtins(clientRes.client, gtins)
				const byGtin = new Map<string, { dto: Record<string, unknown>; local: MappedLocal }>()
				for (const item of foundItems) {
					for (const key of collectGtinKeys(item.local, item.dto)) {
						if (!byGtin.has(key)) byGtin.set(key, item)
					}
				}

				for (const gtin of gtins) {
					const match = byGtin.get(normalizeGtin(gtin))
					if (!match) {
						results.push({ sku: gtin, action: 'not_found' })
						continue
					}
					const blingId = String(match.local.blingId || '').trim()
					if (blingId && upsertedBlingIds.has(blingId)) continue
					if (blingId) upsertedBlingIds.add(blingId)
					results.push(
						await upsertSyncedProduct({
							supabase: auth.supabase,
							organizationId: auth.organizationId,
							userId: auth.userId,
							local: match.local,
							skuQuery: gtin,
						}),
					)
				}
			}
		}

		const created = results.filter((r) => r.action === 'created').length
		const updated = results.filter((r) => r.action === 'updated').length
		const notFound = results.filter((r) => r.action === 'not_found').length
		const invalid = results.filter((r) => r.action === 'invalid').length
		const synced = created + updated
		const filter = mode === 'latest' ? 'criterio:1' : describeLookupFilter(skus, gtins)
		const lookupCount = skus.length + gtins.length

		if (synced === 0) {
			return NextResponse.json({
				ok: false,
				error: 'product_not_found',
				results,
				created,
				updated,
				notFound,
				invalid,
				filter,
			}, { status: 404 })
		}

		const firstOk = results.find((r) => r.action === 'created' || r.action === 'updated')
		return NextResponse.json({
			ok: true,
			action: mode === 'latest'
				? 'latest'
				: (lookupCount === 1 ? firstOk?.action : 'batch'),
			productId: firstOk?.productId,
			productName: firstOk?.productName,
			results,
			created,
			updated,
			notFound,
			invalid,
			fetched: results.length,
			filter,
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		if (message === 'db_error') {
			return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
		}
		return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
	}
}
