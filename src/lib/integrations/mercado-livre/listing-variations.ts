import {
	aggregateMeliFlexStatus,
	displayFieldsFromStoredRaw,
	extractMeliListingDisplayFields,
	type MeliFlexAggregateStatus,
	type MeliFlexStatus,
	originalPriceCentsFromMeliItem,
	sumNullableStock,
} from '@/lib/integrations/mercado-livre/listing-display'
import {
	aggregateMeliListingMetadata,
	extractMeliListingMetadata,
	type MeliListingMetadata,
	meliListingMetadataFromStoredRaw,
} from '@/lib/integrations/mercado-livre/listing-metadata'
import { extractSellerSkuFromMeliItem } from '@/lib/integrations/mercado-livre/product-resolve'

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

export type MeliListingChild = {
	key: string
	title: string
	ml_item_id: string | null
	seller_sku: string | null
	barcode: string | null
	price_cents: number | null
	original_price_cents: number | null
	stock_full: number | null
	stock_deposito: number | null
	flex_status: MeliFlexStatus
	available_quantity: number | null
	sold_quantity: number | null
	thumbnail_url: string | null
	permalink: string | null
	product_id: string | null
	status: string | null
	meta: MeliListingMetadata
}

export type MeliListingCard = {
	id: string
	ml_item_id: string
	product_id: string | null
	title: string
	permalink: string | null
	thumbnail_url: string | null
	status: string
	price_cents: number | null
	original_price_cents: number | null
	stock_full: number | null
	stock_deposito: number | null
	flex_status: MeliFlexStatus
	flex_aggregate_status: MeliFlexAggregateStatus
	available_quantity: number | null
	sold_quantity: number | null
	seller_sku: string | null
	barcode: string | null
	synced_at: string
	user_product_id: string | null
	family_id: string | null
	family_name: string | null
	picker_label: string | null
	variations: MeliListingChild[]
	product?: { id: string; name: string } | null
	meta: MeliListingMetadata
}

export type MeliListingGroup = {
	key: string
	listing: MeliListingCard
	children: MeliListingChild[]
}

export function meliListingMetadataFromRaw(raw: unknown): MeliListingMetadata {
	return meliListingMetadataFromStoredRaw(raw)
}

export { type MeliListingMetadata } from '@/lib/integrations/mercado-livre/listing-metadata'

export function meliListingDisplayFromRaw(
	raw: unknown,
	priceCents: number | null,
): Pick<
	MeliListingCard,
	| 'original_price_cents'
	| 'stock_full'
	| 'stock_deposito'
	| 'flex_status'
	| 'flex_aggregate_status'
> {
	const display = displayFieldsFromStoredRaw(raw)
	const row = asRecord(raw)
	const originalPriceCents =
		display.original_price_cents ??
		(row ? originalPriceCentsFromMeliItem(row, priceCents) : null)

	return {
		original_price_cents: originalPriceCents,
		stock_full: display.stock_full,
		stock_deposito: display.stock_deposito,
		flex_status: display.flex_status,
		flex_aggregate_status: display.flex_status,
	}
}

function variationStockFromParent(
	parentStock: { stock_full: number | null; stock_deposito: number | null },
	quantity: number | null,
): Pick<MeliListingChild, 'stock_full' | 'stock_deposito'> {
	if (quantity == null) {
		return { stock_full: null, stock_deposito: null }
	}
	if (parentStock.stock_full != null && parentStock.stock_deposito == null) {
		return { stock_full: quantity, stock_deposito: 0 }
	}
	if (parentStock.stock_deposito != null && parentStock.stock_full == null) {
		return { stock_full: null, stock_deposito: quantity }
	}
	if (parentStock.stock_full != null || parentStock.stock_deposito != null) {
		return {
			stock_full: parentStock.stock_full != null ? quantity : null,
			stock_deposito: parentStock.stock_deposito != null ? quantity : null,
		}
	}
	return { stock_full: null, stock_deposito: quantity }
}

function originalPriceCentsFromVariation(
	item: Record<string, unknown>,
	variationPriceCents: number | null,
): number | null {
	return originalPriceCentsFromMeliItem(item, variationPriceCents)
}

const MAX_VARIATIONS = 80

function pictureUrlById(item: Record<string, unknown>): Map<string, string> {
	const map = new Map<string, string>()
	const pics = item.pictures
	if (!Array.isArray(pics)) return map
	for (const pic of pics) {
		const row = asRecord(pic)
		const id = trimText(row?.id)
		const url = trimText(row?.secure_url) ?? trimText(row?.url)
		if (id && url) map.set(id, url)
	}
	return map
}

export function variationLabelFromCombinations(value: unknown): string | null {
	if (!Array.isArray(value)) return null
	const parts: string[] = []
	for (const item of value) {
		const row = asRecord(item)
		const name = trimText(row?.value_name) ?? trimText(row?.value_id)
		if (name) parts.push(name)
	}
	if (parts.length === 0) return null
	return parts.join(' · ')
}

export function normalizeMeliFamilyId(value: unknown): string | null {
	const raw = trimText(value)
	if (!raw) return null
	if (/^\d+\.0+$/.test(raw)) return String(Math.trunc(Number(raw)))
	return raw
}

export function userProductIdFromMeliItem(
	item: Record<string, unknown>,
): string | null {
	return trimText(item.user_product_id)
}

export function familyIdFromMeliItem(
	item: Record<string, unknown>,
): string | null {
	return normalizeMeliFamilyId(item.family_id)
}

export function familyNameFromMeliItem(
	item: Record<string, unknown>,
): string | null {
	return trimText(item.family_name)
}

const PICKER_ATTRIBUTE_IDS = [
	'COLOR',
	'SIZE',
	'FABRIC_DESIGN',
	'VOLTAGE',
	'TONE',
	'PATTERN',
	'STORAGE_CAPACITY',
]

const BARCODE_ATTRIBUTE_IDS = [
	'GTIN',
	'EAN',
	'UPC',
	'ISBN',
	'BARCODE',
	'CODIGO_DE_BARRAS',
]

function attributeValueName(
	item: Record<string, unknown>,
	attributeId: string,
): string | null {
	const attrs = item.attributes
	if (!Array.isArray(attrs)) return null
	for (const attr of attrs) {
		const row = asRecord(attr)
		if (trimText(row?.id) !== attributeId) continue
		return trimText(row?.value_name) ?? trimText(row?.value_id)
	}
	return null
}

export function extractMeliBarcode(
	item: Record<string, unknown>,
): string | null {
	for (const id of BARCODE_ATTRIBUTE_IDS) {
		const value = attributeValueName(item, id)
		if (value) return value
	}
	return null
}

export function extractPickerLabel(
	item: Record<string, unknown>,
): string | null {
	for (const id of PICKER_ATTRIBUTE_IDS) {
		const value = attributeValueName(item, id)
		if (value) return value
	}

	const familyName = familyNameFromMeliItem(item)
	const title = trimText(item.title)
	if (familyName && title) {
		const prefix = familyName.toLowerCase()
		if (title.toLowerCase().startsWith(prefix)) {
			const rest = title
				.slice(familyName.length)
				.replace(/^[\s\-|,]+/, '')
				.trim()
			if (rest) return rest
		}
	}

	const variations = item.variations
	if (Array.isArray(variations) && variations[0]) {
		const first = asRecord(variations[0])
		const fromCombo = variationLabelFromCombinations(
			first?.attribute_combinations,
		)
		if (fromCombo) return fromCombo
	}

	return null
}

function extractSellerSkuFromVariation(
	variation: Record<string, unknown>,
): string | null {
	const fromAttributes = extractSellerSkuFromMeliItem(variation)
	if (fromAttributes) return fromAttributes
	return (
		trimText(variation.seller_custom_field) ?? trimText(variation.seller_sku)
	)
}

export function listingGroupKey(listing: {
	family_id: string | null
	family_name: string | null
	user_product_id: string | null
}): string | null {
	const familyId = normalizeMeliFamilyId(listing.family_id)
	if (familyId) return `fam:${familyId}`
	const familyName = trimText(listing.family_name)?.toLowerCase()
	if (familyName) return `fname:${familyName}`
	const userProductId = trimText(listing.user_product_id)
	if (userProductId) return `up:${userProductId}`
	return null
}

export function extractMeliItemVariations(
	item: Record<string, unknown>,
): MeliListingChild[] {
	const rows = item.variations
	if (!Array.isArray(rows) || rows.length === 0) return []

	const pictures = pictureUrlById(item)
	const fallbackThumb =
		trimText(item.secure_thumbnail) ?? trimText(item.thumbnail)
	const permalink = trimText(item.permalink)
	const parentId = trimText(item.id)
	const parentStatus = trimText(item.status)?.toLowerCase() ?? null
	const barcode = extractMeliBarcode(item)
	const parentDisplay = extractMeliListingDisplayFields(item)
	const parentMeta = extractMeliListingMetadata(item)
	const parentStock = {
		stock_full: parentDisplay.stock_full,
		stock_deposito: parentDisplay.stock_deposito,
	}

	const out: MeliListingChild[] = []
	for (const raw of rows) {
		if (out.length >= MAX_VARIATIONS) break
		const row = asRecord(raw)
		if (!row) continue
		const id = trimText(row.id)
		if (!id) continue
		const pictureIds = Array.isArray(row.picture_ids) ? row.picture_ids : []
		const firstPicId = pictureIds.length > 0 ? trimText(pictureIds[0]) : null
		const title =
			variationLabelFromCombinations(row.attribute_combinations) ??
			`Variação ${id}`

		const priceCents = reaisToCents(row.price)
		const variationQty = toIntOrNull(row.available_quantity)
		const variationStock = variationStockFromParent(parentStock, variationQty)

		out.push({
			key: `${parentId || 'item'}:${id}`,
			title,
			ml_item_id: id,
			seller_sku: extractSellerSkuFromVariation(row),
			barcode,
			price_cents: priceCents,
			original_price_cents: originalPriceCentsFromVariation(item, priceCents),
			stock_full: variationStock.stock_full,
			stock_deposito: variationStock.stock_deposito,
			flex_status: parentDisplay.flex_status,
			available_quantity: variationQty,
			sold_quantity: toIntOrNull(row.sold_quantity),
			thumbnail_url:
				(firstPicId ? pictures.get(firstPicId) : null) ?? fallbackThumb,
			permalink,
			product_id: null,
			status: parentStatus,
			meta: parentMeta,
		})
	}
	return out
}

export function slimMeliListingVariations(
	item: Record<string, unknown>,
): Record<string, unknown>[] {
	return extractMeliItemVariations(item).map((row) => ({
		id: row.ml_item_id,
		title: row.title,
		seller_sku: row.seller_sku,
		barcode: row.barcode,
		price_cents: row.price_cents,
		available_quantity: row.available_quantity,
		sold_quantity: row.sold_quantity,
		thumbnail_url: row.thumbnail_url,
	}))
}

function childFromStoredVariation(
	value: unknown,
	fallback: {
		permalink: string | null
		thumbnail_url: string | null
		status: string | null
		parentId: string
		parentBarcode: string | null
		parentDisplay: ReturnType<typeof meliListingDisplayFromRaw>
		parentMeta: MeliListingMetadata
	},
): MeliListingChild | null {
	const row = asRecord(value)
	if (!row) return null
	const id = trimText(row.id) ?? trimText(row.ml_item_id)
	if (!id) return null
	const title = trimText(row.title) ?? `Variação ${id}`
	const priceCents =
		row.price_cents == null
			? reaisToCents(row.price)
			: toIntOrNull(row.price_cents)
	const variationQty = toIntOrNull(row.available_quantity)
	const variationStock = variationStockFromParent(
		{
			stock_full: fallback.parentDisplay.stock_full,
			stock_deposito: fallback.parentDisplay.stock_deposito,
		},
		variationQty,
	)
	return {
		key: `${fallback.parentId}:${id}`,
		title,
		ml_item_id: id,
		seller_sku:
			trimText(row.seller_sku) ??
			trimText(row.seller_custom_field) ??
			extractSellerSkuFromVariation(row),
		barcode: trimText(row.barcode) ?? fallback.parentBarcode,
		price_cents: priceCents,
		original_price_cents: fallback.parentDisplay.original_price_cents,
		stock_full: variationStock.stock_full,
		stock_deposito: variationStock.stock_deposito,
		flex_status: fallback.parentDisplay.flex_status,
		available_quantity: variationQty,
		sold_quantity: toIntOrNull(row.sold_quantity),
		thumbnail_url: trimText(row.thumbnail_url) ?? fallback.thumbnail_url,
		permalink: fallback.permalink,
		product_id: null,
		status: fallback.status,
		meta: fallback.parentMeta,
	}
}

export function variationsFromStoredRaw(params: {
	raw: unknown
	mlItemId: string
	permalink: string | null
	thumbnailUrl: string | null
	status: string | null
}): MeliListingChild[] {
	const raw = asRecord(params.raw)
	if (!raw) return []
	const rows = raw.variations
	if (!Array.isArray(rows) || rows.length === 0) return []
	const parentBarcode = barcodeFromStoredRaw(params.raw)
	const parentDisplay = meliListingDisplayFromRaw(params.raw, null)
	const parentMeta = meliListingMetadataFromStoredRaw(params.raw)
	const out: MeliListingChild[] = []
	for (const item of rows) {
		const child = childFromStoredVariation(item, {
			permalink: params.permalink,
			thumbnail_url: params.thumbnailUrl,
			status: params.status,
			parentId: params.mlItemId,
			parentBarcode,
			parentDisplay,
			parentMeta,
		})
		if (child) out.push(child)
		if (out.length >= MAX_VARIATIONS) break
	}
	return out
}

export function userProductIdFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return trimText(row.user_product_id)
}

export function familyIdFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return normalizeMeliFamilyId(row.family_id)
}

export function familyNameFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return trimText(row.family_name)
}

export function barcodeFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return trimText(row.barcode) ?? extractMeliBarcode(row)
}

export function sellerSkuFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return extractSellerSkuFromMeliItem(row)
}

export function pickerLabelFromStoredRaw(raw: unknown): string | null {
	const row = asRecord(raw)
	if (!row) return null
	return trimText(row.picker_label) ?? extractPickerLabel(row)
}

function listingToChild(listing: MeliListingCard): MeliListingChild {
	const fromVariation = listing.variations[0]
	return {
		key: listing.id,
		title: fromVariation?.title || listing.picker_label || listing.title,
		ml_item_id: listing.ml_item_id,
		seller_sku: fromVariation?.seller_sku || listing.seller_sku,
		barcode: fromVariation?.barcode ?? listing.barcode,
		price_cents: fromVariation?.price_cents ?? listing.price_cents,
		original_price_cents:
			fromVariation?.original_price_cents ?? listing.original_price_cents,
		stock_full: listing.stock_full,
		stock_deposito: listing.stock_deposito,
		flex_status: listing.flex_status,
		available_quantity:
			fromVariation?.available_quantity ?? listing.available_quantity,
		sold_quantity: fromVariation?.sold_quantity ?? listing.sold_quantity,
		thumbnail_url: fromVariation?.thumbnail_url || listing.thumbnail_url,
		permalink: listing.permalink,
		product_id: listing.product_id,
		status: listing.status,
		meta: listing.meta,
	}
}

function sumNullable(values: Array<number | null | undefined>): number | null {
	let total = 0
	let hasValue = false
	for (const value of values) {
		if (value == null || !Number.isFinite(value)) continue
		total += value
		hasValue = true
	}
	return hasValue ? total : null
}

function minNullable(values: Array<number | null | undefined>): number | null {
	let min: number | null = null
	for (const value of values) {
		if (value == null || !Number.isFinite(value)) continue
		if (min == null || value < min) min = value
	}
	return min
}

function withAggregates(
	listing: MeliListingCard,
	children: MeliListingChild[],
): MeliListingCard {
	if (children.length < 2) {
		return {
			...listing,
			flex_aggregate_status: listing.flex_status,
		}
	}

	const pricedChildren = children.filter((child) => child.price_cents != null)
	const minPriceChild =
		pricedChildren.length > 0
			? pricedChildren.reduce((current, child) =>
					(child.price_cents ?? Number.POSITIVE_INFINITY) <
					(current.price_cents ?? Number.POSITIVE_INFINITY)
						? child
						: current,
				)
			: null

	return {
		...listing,
		available_quantity: sumNullable(
			children.map((child) => child.available_quantity),
		),
		sold_quantity: sumNullable(children.map((child) => child.sold_quantity)),
		price_cents: minNullable(children.map((child) => child.price_cents)),
		original_price_cents: minPriceChild?.original_price_cents ?? null,
		stock_full: sumNullableStock(children.map((child) => child.stock_full)),
		stock_deposito: sumNullableStock(
			children.map((child) => child.stock_deposito),
		),
		flex_aggregate_status: aggregateMeliFlexStatus(
			children.map((child) => child.flex_status),
		),
		meta: aggregateMeliListingMetadata(children.map((child) => child.meta)),
	}
}

function singletonGroup(listing: MeliListingCard): MeliListingGroup {
	const children =
		listing.variations.length >= 2
			? listing.variations.map((child) => ({
					...child,
					meta: child.meta ?? listing.meta,
				}))
			: []
	return {
		key: listing.id,
		listing: withAggregates(listing, children),
		children,
	}
}

export function groupMeliListings(
	listings: MeliListingCard[],
): MeliListingGroup[] {
	const familyBuckets = new Map<string, MeliListingCard[]>()
	const leftovers: MeliListingCard[] = []

	for (const listing of listings) {
		const groupKey = listingGroupKey(listing)
		if (!groupKey) {
			leftovers.push(listing)
			continue
		}
		const bucket = familyBuckets.get(groupKey)
		if (bucket) bucket.push(listing)
		else familyBuckets.set(groupKey, [listing])
	}

	const groups: MeliListingGroup[] = []

	for (const [groupKey, bucket] of familyBuckets) {
		if (bucket.length < 2) {
			leftovers.push(bucket[0])
			continue
		}
		const ordered = [...bucket].sort((a, b) => {
			const byDate = String(b.synced_at).localeCompare(String(a.synced_at))
			if (byDate !== 0) return byDate
			return a.ml_item_id.localeCompare(b.ml_item_id)
		})
		const parent = ordered[0]
		const children = ordered.map(listingToChild)
		const familyId = normalizeMeliFamilyId(parent.family_id)
		groups.push({
			key: groupKey,
			listing: {
				...withAggregates(parent, children),
				title: parent.family_name || parent.title,
				ml_item_id: familyId || parent.ml_item_id,
			},
			children,
		})
	}

	for (const listing of leftovers) {
		groups.push(singletonGroup(listing))
	}

	groups.sort((a, b) => {
		const byDate = String(b.listing.synced_at).localeCompare(
			String(a.listing.synced_at),
		)
		if (byDate !== 0) return byDate
		return a.listing.ml_item_id.localeCompare(b.listing.ml_item_id)
	})

	return groups
}

function haystack(values: Array<string | null | undefined>): string {
	return values
		.map((value) =>
			String(value || '')
				.trim()
				.toLowerCase(),
		)
		.filter(Boolean)
		.join(' ')
}

export function meliListingGroupMatchesQuery(
	group: MeliListingGroup,
	query: string,
): boolean {
	const q = query.trim().toLowerCase()
	if (!q) return true
	const listing = group.listing
	const text = haystack([
		listing.title,
		listing.ml_item_id,
		listing.seller_sku,
		listing.barcode,
		listing.family_id,
		listing.family_name,
		listing.product?.name,
		...group.children.flatMap((child) => [
			child.title,
			child.ml_item_id,
			child.seller_sku,
			child.barcode,
		]),
	])
	return text.includes(q)
}
