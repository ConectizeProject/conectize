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

function toIntOrNull(value: unknown): number | null {
	const n = Number(value)
	if (!Number.isFinite(n)) return null
	return Math.round(n)
}

const MAX_PICTURES = 8

export type MeliListingUpsertRow = {
	organization_id: string
	ml_item_id: string
	product_id: string | null
	title: string
	permalink: string | null
	thumbnail_url: string | null
	status: string
	price_cents: number | null
	available_quantity: number | null
	sold_quantity: number | null
	seller_sku: string | null
	category_id: string | null
	pictures: string[] | null
	raw: Record<string, unknown>
	synced_at: string
	updated_at: string
}

function extractPictures(item: Record<string, unknown>): string[] | null {
	const pics = item.pictures
	if (!Array.isArray(pics)) return null
	const urls: string[] = []
	for (const pic of pics) {
		const row = asRecord(pic)
		const url = trimText(row?.secure_url) ?? trimText(row?.url) ?? null
		if (url) urls.push(url)
		if (urls.length >= MAX_PICTURES) break
	}
	return urls.length > 0 ? urls : null
}

function slimRaw(item: Record<string, unknown>): Record<string, unknown> {
	return {
		id: item.id ?? null,
		title: item.title ?? null,
		status: item.status ?? null,
		price: item.price ?? null,
		available_quantity: item.available_quantity ?? null,
		sold_quantity: item.sold_quantity ?? null,
		permalink: item.permalink ?? null,
		thumbnail: item.thumbnail ?? null,
		secure_thumbnail: item.secure_thumbnail ?? null,
		category_id: item.category_id ?? null,
		seller_custom_field: item.seller_custom_field ?? null,
		seller_sku: item.seller_sku ?? null,
	}
}

export function mapMeliItemToListingRow(params: {
	organizationId: string
	item: Record<string, unknown>
	productId: string | null
	syncedAt?: string
}): MeliListingUpsertRow | null {
	const mlItemId = trimText(params.item.id)
	if (!mlItemId) return null

	const now = params.syncedAt ?? new Date().toISOString()
	const title = trimText(params.item.title) ?? mlItemId
	const sellerSku =
		trimText(params.item.seller_custom_field) ??
		trimText(params.item.seller_sku)

	return {
		organization_id: params.organizationId,
		ml_item_id: mlItemId,
		product_id: params.productId,
		title,
		permalink: trimText(params.item.permalink),
		thumbnail_url:
			trimText(params.item.secure_thumbnail) ?? trimText(params.item.thumbnail),
		status: trimText(params.item.status)?.toLowerCase() || 'unknown',
		price_cents: reaisToCents(params.item.price),
		available_quantity: toIntOrNull(params.item.available_quantity),
		sold_quantity: toIntOrNull(params.item.sold_quantity),
		seller_sku: sellerSku,
		category_id: trimText(params.item.category_id),
		pictures: extractPictures(params.item),
		raw: slimRaw(params.item),
		synced_at: now,
		updated_at: now,
	}
}
