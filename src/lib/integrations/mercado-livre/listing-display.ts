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

export type MeliFlexStatus = 'active' | 'inactive' | 'unavailable'

export type MeliFlexAggregateStatus = MeliFlexStatus | 'mixed'

export type MeliListingStock = {
	stock_full: number | null
	stock_deposito: number | null
}

export type MeliListingDisplayFields = {
	flex_status: MeliFlexStatus
	stock_full: number | null
	stock_deposito: number | null
	original_price_cents: number | null
}

export function flexStatusFromMeliTags(tags: unknown): MeliFlexStatus {
	if (!Array.isArray(tags)) return 'unavailable'
	const set = new Set(tags.map((tag) => String(tag)))
	if (set.has('self_service_in')) return 'active'
	if (set.has('self_service_out') || set.has('self_service_available')) {
		return 'inactive'
	}
	return 'unavailable'
}

export function aggregateMeliFlexStatus(
	statuses: MeliFlexStatus[],
): MeliFlexAggregateStatus {
	if (statuses.length === 0) return 'unavailable'
	if (statuses.every((status) => status === 'active')) return 'active'
	if (statuses.some((status) => status === 'active')) return 'mixed'
	return 'unavailable'
}

export function stockFromMeliLocations(locations: unknown): MeliListingStock {
	let stockFull: number | null = null
	let stockDeposito: number | null = null
	if (!Array.isArray(locations)) {
		return { stock_full: stockFull, stock_deposito: stockDeposito }
	}
	for (const entry of locations) {
		const row = asRecord(entry)
		if (!row) continue
		const type = trimText(row.type)
		const quantity = toIntOrNull(row.quantity)
		if (quantity == null) continue
		if (type === 'meli_facility') {
			stockFull = (stockFull ?? 0) + quantity
			continue
		}
		if (type === 'selling_address' || type === 'seller_warehouse') {
			stockDeposito = (stockDeposito ?? 0) + quantity
		}
	}
	return { stock_full: stockFull, stock_deposito: stockDeposito }
}

export function stockFromMeliItem(
	item: Record<string, unknown>,
	locations?: unknown,
): MeliListingStock {
	const fromLocations = stockFromMeliLocations(locations)
	if (
		fromLocations.stock_full != null ||
		fromLocations.stock_deposito != null
	) {
		return fromLocations
	}

	const shipping = asRecord(item.shipping)
	const logisticType = trimText(shipping?.logistic_type)?.toLowerCase()
	const available = toIntOrNull(item.available_quantity)

	if (logisticType === 'fulfillment') {
		return {
			stock_full: available,
			stock_deposito: 0,
		}
	}

	return {
		stock_full: null,
		stock_deposito: available,
	}
}

export function originalPriceCentsFromMeliItem(
	item: Record<string, unknown>,
	priceCents: number | null,
): number | null {
	const original = reaisToCents(item.original_price)
	if (original == null || priceCents == null) return null
	if (original <= priceCents) return null
	return original
}

export function extractMeliListingDisplayFields(
	item: Record<string, unknown>,
	options?: {
		stockLocations?: unknown
		priceCents?: number | null
	},
): MeliListingDisplayFields {
	const priceCents = options?.priceCents ?? reaisToCents(item.price) ?? null
	const stock = stockFromMeliItem(item, options?.stockLocations)

	return {
		flex_status: flexStatusFromMeliTags(item.tags),
		stock_full: stock.stock_full,
		stock_deposito: stock.stock_deposito,
		original_price_cents: originalPriceCentsFromMeliItem(item, priceCents),
	}
}

export function displayFieldsFromStoredRaw(
	raw: unknown,
): MeliListingDisplayFields {
	const row = asRecord(raw)
	if (!row) {
		return {
			flex_status: 'unavailable',
			stock_full: null,
			stock_deposito: null,
			original_price_cents: null,
		}
	}

	const flexRaw = trimText(row.flex_status)
	const flexStatus: MeliFlexStatus =
		flexRaw === 'active' || flexRaw === 'inactive' || flexRaw === 'unavailable'
			? flexRaw
			: flexStatusFromMeliTags(row.tags)

	return {
		flex_status: flexStatus,
		stock_full: toIntOrNull(row.stock_full),
		stock_deposito: toIntOrNull(row.stock_deposito),
		original_price_cents:
			row.original_price_cents == null
				? originalPriceCentsFromMeliItem(
						row,
						reaisToCents(row.price) ?? toIntOrNull(row.price_cents),
					)
				: toIntOrNull(row.original_price_cents),
	}
}

export function sumNullableStock(
	values: Array<number | null | undefined>,
): number | null {
	let total = 0
	let hasValue = false
	for (const value of values) {
		if (value == null || !Number.isFinite(value)) continue
		total += value
		hasValue = true
	}
	return hasValue ? total : null
}
