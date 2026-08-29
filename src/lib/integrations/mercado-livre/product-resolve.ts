import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliItem,
	type HubConnection,
} from '@/lib/integrations/mercado-livre/api'
import { allocateCatalogSortKeyForInsert } from '@/lib/products/catalog-sort-key'

type ServiceClient = SupabaseClient

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return value as Record<string, unknown>
}

function trimText(value: unknown): string | null {
	if (value == null) return null
	const s = String(value).trim()
	return s || null
}

function reaisToCents(value: unknown): number | null {
	const n = Number(value)
	if (!Number.isFinite(n) || n < 0) return null
	return Math.round(n * 100)
}

function escapeIlikeExact(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type MeliOrderItemRef = {
	itemId: string
	title: string | null
	sellerSku: string | null
	unitPrice: number | null
}

export type ResolveMeliProductResult = {
	productId: string
	created: boolean
	linked: boolean
}

export function parseMeliOrderItemRef(
	orderItem: unknown,
): MeliOrderItemRef | null {
	const row = asRecord(orderItem)
	if (!row) return null
	const item = asRecord(row.item) ?? {}
	const itemId = trimText(item.id)
	if (!itemId) return null
	const sellerSku =
		trimText(item.seller_sku) ??
		trimText(item.seller_custom_field) ??
		trimText(row.seller_sku) ??
		trimText(row.seller_custom_field)
	const title = trimText(item.title) ?? trimText(row.title)
	const unitPrice = Number.isFinite(Number(row.unit_price))
		? Number(row.unit_price)
		: Number.isFinite(Number(item.price))
			? Number(item.price)
			: null

	return { itemId, title, sellerSku, unitPrice }
}

export function extractSellerSkuFromMeliItem(
	item: Record<string, unknown>,
): string | null {
	return trimText(item.seller_custom_field) ?? trimText(item.seller_sku) ?? null
}

async function findProductIdBySku(
	supabase: ServiceClient,
	organizationId: string,
	sku: string,
): Promise<string | null> {
	const key = sku.trim()
	if (!key) return null

	const { data } = await supabase
		.from('products')
		.select('id')
		.eq('organization_id', organizationId)
		.ilike('sku', escapeIlikeExact(key))
		.limit(1)
		.maybeSingle()

	return data?.id ? String(data.id) : null
}

async function findProductRowByMlItemId(
	supabase: ServiceClient,
	organizationId: string,
	mlItemId: string,
): Promise<{
	id: string
	name: string | null
	sale_price_cents: number | null
	image_url: string | null
	sku: string | null
} | null> {
	const key = mlItemId.trim()
	if (!key) return null

	const { data } = await supabase
		.from('products')
		.select('id, name, sale_price_cents, image_url, sku')
		.eq('organization_id', organizationId)
		.eq('ml_item_id', key)
		.limit(1)
		.maybeSingle()

	if (!data?.id) return null
	return {
		id: String(data.id),
		name: data.name != null ? String(data.name) : null,
		sale_price_cents:
			data.sale_price_cents == null ? null : Number(data.sale_price_cents),
		image_url: data.image_url != null ? String(data.image_url) : null,
		sku: data.sku != null ? String(data.sku) : null,
	}
}

async function backfillMlItemId(
	supabase: ServiceClient,
	productId: string,
	mlItemId: string,
): Promise<void> {
	await supabase
		.from('products')
		.update({
			ml_item_id: mlItemId,
			updated_at: new Date().toISOString(),
		})
		.eq('id', productId)
		.is('ml_item_id', null)
}

/**
 * Preenche só campos vazios no produto já vinculado (não sobrescreve edições do portal).
 */
async function fillEmptyProductFieldsFromMeli(
	supabase: ServiceClient,
	productId: string,
	item: Record<string, unknown>,
): Promise<void> {
	const { data: row } = await supabase
		.from('products')
		.select('name, sale_price_cents, image_url, sku, ml_item_id')
		.eq('id', productId)
		.maybeSingle()

	if (!row) return

	const patch: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
	}
	let changed = false

	const mlItemId = trimText(item.id)
	if (mlItemId && !row.ml_item_id) {
		patch.ml_item_id = mlItemId
		changed = true
	}

	const title = trimText(item.title)
	if (title && !String(row.name || '').trim()) {
		patch.name = title
		changed = true
	}

	const sku = extractSellerSkuFromMeliItem(item)
	if (sku && !String(row.sku || '').trim()) {
		patch.sku = sku
		changed = true
	}

	const price = reaisToCents(item.price)
	if (
		price != null &&
		(row.sale_price_cents == null || row.sale_price_cents === 0)
	) {
		patch.sale_price_cents = price
		changed = true
	}

	const thumb = trimText(item.secure_thumbnail) ?? trimText(item.thumbnail)
	if (thumb && !String(row.image_url || '').trim()) {
		patch.image_url = thumb
		changed = true
	}

	if (!changed) return
	await supabase.from('products').update(patch).eq('id', productId)
}

async function createMinimalProductFromMeliItem(params: {
	supabase: ServiceClient
	organizationId: string
	createdBy: string | null
	itemRef: MeliOrderItemRef
	itemPayload: Record<string, unknown> | null
}): Promise<string> {
	const item = params.itemPayload ?? {}
	const name =
		trimText(item.title) ?? params.itemRef.title ?? params.itemRef.itemId
	const sku = extractSellerSkuFromMeliItem(item) ?? params.itemRef.sellerSku
	const salePriceCents =
		reaisToCents(item.price) ?? reaisToCents(params.itemRef.unitPrice)
	const thumbnail = trimText(item.secure_thumbnail) ?? trimText(item.thumbnail)

	const catalogSortKey = await allocateCatalogSortKeyForInsert(
		params.supabase,
		{
			parentBlingId: null,
		},
	)

	const insertPayload: Record<string, unknown> = {
		organization_id: params.organizationId,
		name,
		sku,
		ml_item_id: params.itemRef.itemId,
		sale_price_cents: salePriceCents,
		kind: 'product',
		is_active: true,
		bling_sync_pending: false,
		catalog_sort_key: catalogSortKey,
		created_by: params.createdBy,
		image_url: thumbnail,
	}

	const { data, error } = await params.supabase
		.from('products')
		.insert(insertPayload)
		.select('id')
		.single()

	if (error || !data?.id) {
		throw new Error(error?.message || 'meli_product_insert_failed')
	}

	return String(data.id)
}

/**
 * Resolve/cria produto a partir do payload completo do anúncio ML.
 */
export async function resolveMeliProductFromItemPayload(params: {
	supabase: ServiceClient
	organizationId: string
	createdBy: string | null
	itemPayload: Record<string, unknown>
}): Promise<ResolveMeliProductResult> {
	const item = params.itemPayload
	const itemId = trimText(item.id)
	if (!itemId) throw new Error('meli_item_id_missing')

	const sellerSku = extractSellerSkuFromMeliItem(item)
	const itemRef: MeliOrderItemRef = {
		itemId,
		title: trimText(item.title),
		sellerSku,
		unitPrice: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
	}

	if (sellerSku) {
		const bySku = await findProductIdBySku(
			params.supabase,
			params.organizationId,
			sellerSku,
		)
		if (bySku) {
			await backfillMlItemId(params.supabase, bySku, itemId)
			await fillEmptyProductFieldsFromMeli(params.supabase, bySku, item)
			return { productId: bySku, created: false, linked: true }
		}
	}

	const byItemId = await findProductRowByMlItemId(
		params.supabase,
		params.organizationId,
		itemId,
	)
	if (byItemId) {
		await fillEmptyProductFieldsFromMeli(params.supabase, byItemId.id, item)
		return { productId: byItemId.id, created: false, linked: true }
	}

	const productId = await createMinimalProductFromMeliItem({
		supabase: params.supabase,
		organizationId: params.organizationId,
		createdBy: params.createdBy,
		itemRef,
		itemPayload: item,
	})
	return { productId, created: true, linked: false }
}

/**
 * Resolve produto local: SKU do seller → `ml_item_id` → cria cadastro mínimo a partir do anúncio.
 */
export async function resolveMeliProductId(params: {
	supabase: ServiceClient
	organizationId: string
	createdBy: string | null
	connection: HubConnection
	orderItem: unknown
}): Promise<string> {
	const itemRef = parseMeliOrderItemRef(params.orderItem)
	if (!itemRef) {
		throw new Error('meli_order_item_missing_id')
	}

	if (itemRef.sellerSku) {
		const bySku = await findProductIdBySku(
			params.supabase,
			params.organizationId,
			itemRef.sellerSku,
		)
		if (bySku) {
			await backfillMlItemId(params.supabase, bySku, itemRef.itemId)
			return bySku
		}
	}

	const byItemId = await findProductRowByMlItemId(
		params.supabase,
		params.organizationId,
		itemRef.itemId,
	)
	if (byItemId) return byItemId.id

	let itemPayload: Record<string, unknown> | null = null
	try {
		itemPayload = await getMeliItem(
			params.connection,
			itemRef.itemId,
			params.supabase,
		)
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'meli_item_fetch_failed'
		throw new Error(`meli_item_fetch_failed: ${message}`)
	}

	return createMinimalProductFromMeliItem({
		supabase: params.supabase,
		organizationId: params.organizationId,
		createdBy: params.createdBy,
		itemRef,
		itemPayload,
	})
}
