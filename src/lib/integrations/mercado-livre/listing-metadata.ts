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

export type MeliWholesaleTier = {
	min_quantity: number
	price_cents: number
}

export type MeliTechnicalSpec = {
	name: string
	value: string
}

export type MeliListingMetadata = {
	promotions_count: number | null
	date_created: string | null
	last_updated: string | null
	description_plain: string | null
	wholesale_tiers: MeliWholesaleTier[]
	dimensions_label: string | null
	technical_specs: MeliTechnicalSpec[]
	pictures_count: number | null
	user_product_id: string | null
	listing_type: string | null
	free_shipping: boolean | null
	warranty: string | null
}

const DIMENSION_ATTRIBUTE_IDS = new Set([
	'PACKAGE_LENGTH',
	'PACKAGE_WIDTH',
	'PACKAGE_HEIGHT',
	'PACKAGE_WEIGHT',
	'LENGTH',
	'WIDTH',
	'HEIGHT',
	'WEIGHT',
])

const TECHNICAL_SKIP_ATTRIBUTE_IDS = new Set([
	'SELLER_SKU',
	'GTIN',
	'EAN',
	'UPC',
	'ISBN',
	'BARCODE',
	'CODIGO_DE_BARRAS',
	'EMPTY_GTIN_REASON',
	'MPN',
	'BRAND',
	'MODEL',
	'ITEM_CONDITION',
	...DIMENSION_ATTRIBUTE_IDS,
])

function attributeRows(
	item: Record<string, unknown>,
): Array<Record<string, unknown>> {
	const attrs = item.attributes
	if (!Array.isArray(attrs)) return []
	const out: Array<Record<string, unknown>> = []
	for (const attr of attrs) {
		const row = asRecord(attr)
		if (row) out.push(row)
	}
	return out
}

function attributeValue(row: Record<string, unknown>): string | null {
	return trimText(row.value_name) ?? trimText(row.value_id)
}

function attributeById(
	item: Record<string, unknown>,
	attributeId: string,
): string | null {
	for (const row of attributeRows(item)) {
		if (trimText(row.id) !== attributeId) continue
		return attributeValue(row)
	}
	return null
}

function normalizeDimensionValue(value: string | null): string | null {
	if (!value) return null
	const normalized = value.replace(/\s+/g, ' ').replace(/,/g, '.').trim()
	return normalized || null
}

export function extractMeliDimensionsLabel(
	item: Record<string, unknown>,
): string | null {
	const length =
		normalizeDimensionValue(attributeById(item, 'PACKAGE_LENGTH')) ??
		normalizeDimensionValue(attributeById(item, 'LENGTH'))
	const width =
		normalizeDimensionValue(attributeById(item, 'PACKAGE_WIDTH')) ??
		normalizeDimensionValue(attributeById(item, 'WIDTH'))
	const height =
		normalizeDimensionValue(attributeById(item, 'PACKAGE_HEIGHT')) ??
		normalizeDimensionValue(attributeById(item, 'HEIGHT'))
	const weight =
		normalizeDimensionValue(attributeById(item, 'PACKAGE_WEIGHT')) ??
		normalizeDimensionValue(attributeById(item, 'WEIGHT'))

	const sizeParts = [length, width, height].filter(Boolean)
	const sizeLabel = sizeParts.length > 0 ? sizeParts.join(' x ') : null
	if (sizeLabel && weight) return `${sizeLabel} · ${weight}`
	if (sizeLabel) return sizeLabel
	return weight
}

export function extractMeliTechnicalSpecs(
	item: Record<string, unknown>,
	limit = 12,
): MeliTechnicalSpec[] {
	const out: MeliTechnicalSpec[] = []
	for (const row of attributeRows(item)) {
		if (out.length >= limit) break
		const id = trimText(row.id)
		if (!id || TECHNICAL_SKIP_ATTRIBUTE_IDS.has(id)) continue
		const value = attributeValue(row)
		if (!value) continue
		const name = trimText(row.name) ?? id
		out.push({ name, value })
	}
	return out
}

function saleTermValue(
	item: Record<string, unknown>,
	termId: string,
): string | null {
	const terms = item.sale_terms
	if (!Array.isArray(terms)) return null
	for (const term of terms) {
		const row = asRecord(term)
		if (trimText(row?.id) !== termId) continue
		return attributeValue(row ?? {})
	}
	return null
}

function picturesCount(item: Record<string, unknown>): number | null {
	const pics = item.pictures
	if (!Array.isArray(pics)) return null
	return pics.length
}

function wholesaleTierFromPriceRow(
	row: Record<string, unknown>,
): MeliWholesaleTier | null {
	const conditions = asRecord(row.conditions)
	const minQuantity = toIntOrNull(conditions?.min_purchase_unit)
	const priceCents = reaisToCents(row.amount)
	if (minQuantity == null || minQuantity < 2 || priceCents == null) return null
	return { min_quantity: minQuantity, price_cents: priceCents }
}

export function extractMeliWholesaleTiers(
	pricesPayload: unknown,
): MeliWholesaleTier[] {
	const root = asRecord(pricesPayload)
	if (!root) return []

	const tiers = new Map<number, number>()
	const pushTier = (row: Record<string, unknown>) => {
		const tier = wholesaleTierFromPriceRow(row)
		if (!tier) return
		const current = tiers.get(tier.min_quantity)
		if (current == null || tier.price_cents < current) {
			tiers.set(tier.min_quantity, tier.price_cents)
		}
	}

	const prices = root.prices
	if (Array.isArray(prices)) {
		for (const entry of prices) {
			const row = asRecord(entry)
			if (row) pushTier(row)
		}
	}

	const perQuantity = root.price_per_quantity
	if (Array.isArray(perQuantity)) {
		for (const entry of perQuantity) {
			const row = asRecord(entry)
			if (!row) continue
			const conditions = asRecord(row.conditions)
			const minQuantity = toIntOrNull(conditions?.min_purchase_unit)
			const priceCents = reaisToCents(row.amount)
			if (minQuantity == null || minQuantity < 2 || priceCents == null) continue
			const current = tiers.get(minQuantity)
			if (current == null || priceCents < current) {
				tiers.set(minQuantity, priceCents)
			}
		}
	}

	return Array.from(tiers.entries())
		.map(([min_quantity, price_cents]) => ({ min_quantity, price_cents }))
		.sort((a, b) => a.min_quantity - b.min_quantity)
}

export function countMeliPromotions(pricesPayload: unknown): number | null {
	const root = asRecord(pricesPayload)
	if (!root) return null
	let count = 0
	const prices = root.prices
	if (!Array.isArray(prices)) return 0
	for (const entry of prices) {
		const row = asRecord(entry)
		if (!row) continue
		const type = trimText(row.type)?.toLowerCase()
		if (type === 'promotion') count += 1
	}
	return count
}

export function extractMeliDescriptionPlain(
	descriptionPayload: unknown,
): string | null {
	const root = asRecord(descriptionPayload)
	if (!root) return null
	return trimText(root.plain_text) ?? trimText(root.text)
}

export function extractMeliListingMetadata(
	item: Record<string, unknown>,
	extras?: {
		pricesPayload?: unknown
		descriptionPayload?: unknown
	},
): MeliListingMetadata {
	const shipping = asRecord(item.shipping)
	const freeShipping = shipping?.free_shipping
	return {
		promotions_count:
			extras?.pricesPayload != null
				? countMeliPromotions(extras.pricesPayload)
				: toIntOrNull(item.promotions_count),
		date_created: trimText(item.date_created),
		last_updated: trimText(item.last_updated),
		description_plain:
			extras?.descriptionPayload != null
				? extractMeliDescriptionPlain(extras.descriptionPayload)
				: trimText(item.description_plain),
		wholesale_tiers:
			extras?.pricesPayload != null
				? extractMeliWholesaleTiers(extras.pricesPayload)
				: parseStoredWholesaleTiers(item.wholesale_tiers),
		dimensions_label:
			trimText(item.dimensions_label) ?? extractMeliDimensionsLabel(item),
		technical_specs: parseStoredTechnicalSpecs(item.technical_specs).length
			? parseStoredTechnicalSpecs(item.technical_specs)
			: extractMeliTechnicalSpecs(item),
		pictures_count: toIntOrNull(item.pictures_count) ?? picturesCount(item),
		user_product_id: trimText(item.user_product_id),
		listing_type: trimText(item.listing_type),
		free_shipping:
			typeof freeShipping === 'boolean'
				? freeShipping
				: item.free_shipping === true
					? true
					: item.free_shipping === false
						? false
						: null,
		warranty:
			saleTermValue(item, 'WARRANTY_TYPE') ??
			saleTermValue(item, 'WARRANTY_TIME'),
	}
}

function parseStoredWholesaleTiers(value: unknown): MeliWholesaleTier[] {
	if (!Array.isArray(value)) return []
	const out: MeliWholesaleTier[] = []
	for (const entry of value) {
		const row = asRecord(entry)
		if (!row) continue
		const minQuantity = toIntOrNull(row.min_quantity)
		const priceCents = toIntOrNull(row.price_cents)
		if (minQuantity == null || priceCents == null || minQuantity < 2) continue
		out.push({ min_quantity: minQuantity, price_cents: priceCents })
	}
	return out.sort((a, b) => a.min_quantity - b.min_quantity)
}

function parseStoredTechnicalSpecs(value: unknown): MeliTechnicalSpec[] {
	if (!Array.isArray(value)) return []
	const out: MeliTechnicalSpec[] = []
	for (const entry of value) {
		const row = asRecord(entry)
		const name = trimText(row?.name)
		const specValue = trimText(row?.value)
		if (!name || !specValue) continue
		out.push({ name, value: specValue })
	}
	return out
}

export function meliListingMetadataFromStoredRaw(
	raw: unknown,
): MeliListingMetadata {
	const row = asRecord(raw)
	if (!row) {
		return emptyMeliListingMetadata()
	}
	return extractMeliListingMetadata(row)
}

export function emptyMeliListingMetadata(): MeliListingMetadata {
	return {
		promotions_count: null,
		date_created: null,
		last_updated: null,
		description_plain: null,
		wholesale_tiers: [],
		dimensions_label: null,
		technical_specs: [],
		pictures_count: null,
		user_product_id: null,
		listing_type: null,
		free_shipping: null,
		warranty: null,
	}
}

export function slimMeliListingMetadata(
	metadata: MeliListingMetadata,
): Record<string, unknown> {
	return {
		promotions_count: metadata.promotions_count,
		date_created: metadata.date_created,
		last_updated: metadata.last_updated,
		description_plain: metadata.description_plain,
		wholesale_tiers: metadata.wholesale_tiers,
		dimensions_label: metadata.dimensions_label,
		technical_specs: metadata.technical_specs,
		pictures_count: metadata.pictures_count,
		listing_type: metadata.listing_type,
		free_shipping: metadata.free_shipping,
		warranty: metadata.warranty,
	}
}

export function aggregateMeliListingMetadata(
	items: Array<MeliListingMetadata | null | undefined>,
): MeliListingMetadata {
	const valid = items.filter((item): item is MeliListingMetadata => item != null)
	if (valid.length === 0) return emptyMeliListingMetadata()
	if (valid.length === 1) return valid[0]

	const promotions = valid
		.map((item) => item.promotions_count)
		.filter((value): value is number => value != null)
	const datesCreated = valid
		.map((item) => item.date_created)
		.filter((value): value is string => Boolean(value))
	const datesUpdated = valid
		.map((item) => item.last_updated)
		.filter((value): value is string => Boolean(value))

	const wholesaleMap = new Map<number, number>()
	for (const item of valid) {
		for (const tier of item.wholesale_tiers) {
			const current = wholesaleMap.get(tier.min_quantity)
			if (current == null || tier.price_cents < current) {
				wholesaleMap.set(tier.min_quantity, tier.price_cents)
			}
		}
	}

	return {
		promotions_count:
			promotions.length > 0
				? promotions.reduce((sum, value) => sum + value, 0)
				: null,
		date_created:
			datesCreated.length > 0
				? datesCreated.reduce((min, value) => (value < min ? value : min))
				: null,
		last_updated:
			datesUpdated.length > 0
				? datesUpdated.reduce((max, value) => (value > max ? value : max))
				: null,
		description_plain: null,
		wholesale_tiers: Array.from(wholesaleMap.entries())
			.map(([min_quantity, price_cents]) => ({ min_quantity, price_cents }))
			.sort((a, b) => a.min_quantity - b.min_quantity),
		dimensions_label:
			valid.find((item) => item.dimensions_label)?.dimensions_label ?? null,
		technical_specs:
			valid.find((item) => item.technical_specs.length > 0)?.technical_specs ??
			[],
		pictures_count: sumNullable(valid.map((item) => item.pictures_count)),
		user_product_id: null,
		listing_type: valid.find((item) => item.listing_type)?.listing_type ?? null,
		free_shipping: valid.some((item) => item.free_shipping) ? true : null,
		warranty: valid.find((item) => item.warranty)?.warranty ?? null,
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

export function formatMeliRelativeDate(
	iso: string | null | undefined,
): string | null {
	const raw = trimText(iso)
	if (!raw) return null
	const timestamp = Date.parse(raw)
	if (Number.isNaN(timestamp)) return null

	const diffMs = Date.now() - timestamp
	if (diffMs < 0) return 'Agora'

	const minutes = Math.floor(diffMs / 60_000)
	if (minutes < 1) return 'Agora'
	if (minutes < 60) return `Há ${minutes} min`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return hours === 1 ? 'Há 1 h' : `Há ${hours} h`

	const days = Math.floor(hours / 24)
	if (days < 30) return days === 1 ? 'Há 1 dia' : `Há ${days} dias`

	const months = Math.floor(days / 30)
	if (months < 12) return months === 1 ? 'Há 1 mês' : `Há ${months} meses`

	const years = Math.floor(months / 12)
	return years === 1 ? 'Há 1 ano' : `Há ${years} anos`
}
