import { normalizeOptionalGtin } from '@/lib/fiscal/gtin'
import { ORDER_STATUS_SET } from '@/lib/orders/order-status'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const COMMENT_MAX = 6000

const CUSTOMER_FORBIDDEN = new Set([
	'cpf',
	'cnpj',
	'document',
	'isCompany',
	'is_company',
])

const CUSTOMER_FIELDS: Record<string, string> = {
	fullName: 'full_name',
	full_name: 'full_name',
	companyName: 'company_name',
	company_name: 'company_name',
	tradeName: 'trade_name',
	trade_name: 'trade_name',
	email: 'email',
	phone: 'phone',
	mobilePhone: 'mobile_phone',
	mobile_phone: 'mobile_phone',
	contactPhone: 'contact_phone',
	contact_phone: 'contact_phone',
	contactNotes: 'contact_notes',
	contact_notes: 'contact_notes',
	addressFull: 'address_full',
	address_full: 'address_full',
	zipCode: 'zip_code',
	zip_code: 'zip_code',
	state: 'state',
	city: 'city',
	neighborhood: 'neighborhood',
	street: 'street',
	streetNumber: 'street_number',
	street_number: 'street_number',
	streetComplement: 'street_complement',
	street_complement: 'street_complement',
}

const PRODUCT_FORBIDDEN = new Set([
	'costPriceCents',
	'cost_price_cents',
	'ncm',
	'cest',
	'cfop',
	'fiscalOrigin',
	'fiscal_origin',
	'fci',
	'stock',
	'quantity',
	'kind',
	'blingId',
	'bling_id',
])

const PRODUCT_FIELDS = new Set([
	'id',
	'name',
	'sku',
	'barcode',
	'salePriceCents',
	'sale_price_cents',
	'isActive',
	'is_active',
])

export type CustomerPatchResult =
	| { ok: true; id: string; patch: Record<string, string | null> }
	| {
			ok: false
			error:
				| 'invalid_id'
				| 'document_locked'
				| 'field_forbidden'
				| 'empty'
				| 'invalid_field'
			field?: string
	  }

export function buildCustomerPatch(
	input: Record<string, unknown>,
): CustomerPatchResult {
	const id = parseOptionalUuid(input.id)
	if (!id) return { ok: false, error: 'invalid_id' }

	for (const key of Object.keys(input)) {
		if (key === 'id') continue
		if (CUSTOMER_FORBIDDEN.has(key))
			return { ok: false, error: 'document_locked', field: key }
		if (!CUSTOMER_FIELDS[key])
			return { ok: false, error: 'field_forbidden', field: key }
	}

	const patch: Record<string, string | null> = {}
	for (const [key, column] of Object.entries(CUSTOMER_FIELDS)) {
		if (!Object.prototype.hasOwnProperty.call(input, key)) continue
		const value = input[key]
		if (value == null) {
			patch[column] = null
			continue
		}
		if (typeof value !== 'string')
			return { ok: false, error: 'invalid_field', field: key }
		const trimmed = value.trim()
		patch[column] = trimmed ? trimmed : null
	}

	if (Object.keys(patch).length === 0) return { ok: false, error: 'empty' }
	return { ok: true, id, patch }
}

export type ProductPatchResult =
	| {
			ok: true
			id: string
			patch: Record<string, string | number | boolean | null>
	  }
	| {
			ok: false
			error:
				| 'invalid_id'
				| 'field_forbidden'
				| 'empty'
				| 'invalid_field'
				| 'invalid_barcode'
				| 'invalid_price'
				| 'name_required'
			field?: string
	  }

export function buildProductPatch(
	input: Record<string, unknown>,
): ProductPatchResult {
	const id = parseOptionalUuid(input.id)
	if (!id) return { ok: false, error: 'invalid_id' }

	for (const key of Object.keys(input)) {
		if (PRODUCT_FORBIDDEN.has(key))
			return { ok: false, error: 'field_forbidden', field: key }
		if (!PRODUCT_FIELDS.has(key))
			return { ok: false, error: 'field_forbidden', field: key }
	}

	const patch: Record<string, string | number | boolean | null> = {}

	if (Object.prototype.hasOwnProperty.call(input, 'name')) {
		if (typeof input.name !== 'string' || !input.name.trim()) {
			return { ok: false, error: 'name_required' }
		}
		patch.name = input.name.trim()
	}

	if (hasAny(input, 'sku')) {
		const sku = readNullableString(input, 'sku')
		if (sku === 'invalid')
			return { ok: false, error: 'invalid_field', field: 'sku' }
		patch.sku = sku
	}

	if (hasAny(input, 'barcode')) {
		const barcode = normalizeOptionalGtin(input.barcode)
		if (barcode === 'invalid') return { ok: false, error: 'invalid_barcode' }
		patch.barcode = barcode
	}

	if (hasAny(input, 'salePriceCents', 'sale_price_cents')) {
		const raw = Object.prototype.hasOwnProperty.call(input, 'salePriceCents')
			? input.salePriceCents
			: input.sale_price_cents
		if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
			return { ok: false, error: 'invalid_price' }
		}
		patch.sale_price_cents = raw
	}

	if (hasAny(input, 'isActive', 'is_active')) {
		const raw = Object.prototype.hasOwnProperty.call(input, 'isActive')
			? input.isActive
			: input.is_active
		if (typeof raw !== 'boolean')
			return { ok: false, error: 'invalid_field', field: 'isActive' }
		patch.is_active = raw
	}

	if (Object.keys(patch).length === 0) return { ok: false, error: 'empty' }
	return { ok: true, id, patch }
}

export type OrderRefResult =
	| { ok: true; id?: string; displayNumber?: number }
	| { ok: false; error: 'ref_required' | 'invalid_id' | 'invalid_number' }

export function parseOrderRef(input: {
	id?: string
	numero?: string
}): OrderRefResult {
	const idRaw = String(input.id ?? '').trim()
	const numeroRaw = String(input.numero ?? '').trim()
	if (!idRaw && !numeroRaw) return { ok: false, error: 'ref_required' }
	if (idRaw) {
		const id = parseOptionalUuid(idRaw)
		if (!id) return { ok: false, error: 'invalid_id' }
		return { ok: true, id }
	}
	if (!/^\d+$/.test(numeroRaw)) return { ok: false, error: 'invalid_number' }
	const displayNumber = Number.parseInt(numeroRaw, 10)
	if (!Number.isSafeInteger(displayNumber))
		return { ok: false, error: 'invalid_number' }
	return { ok: true, displayNumber }
}

export type OrderStatusInputResult =
	| { ok: true; ref: { id?: string; displayNumber?: number }; status: string }
	| {
			ok: false
			error: 'ref_required' | 'invalid_id' | 'invalid_number' | 'invalid_status'
	  }

export function parseOrderStatusInput(input: {
	id?: string
	numero?: string
	status?: string
}): OrderStatusInputResult {
	const ref = parseOrderRef(input)
	if (ref.ok === false) return ref
	const status = String(input.status ?? '').trim()
	if (!ORDER_STATUS_SET.has(status))
		return { ok: false, error: 'invalid_status' }
	return { ok: true, ref, status }
}

export type OrderCommentInputResult =
	| { ok: true; ref: { id?: string; displayNumber?: number }; content: string }
	| {
			ok: false
			error:
				| 'ref_required'
				| 'invalid_id'
				| 'invalid_number'
				| 'content_required'
				| 'content_too_long'
	  }

export function parseOrderCommentInput(input: {
	id?: string
	numero?: string
	texto?: string
}): OrderCommentInputResult {
	const ref = parseOrderRef(input)
	if (ref.ok === false) return ref
	const content = String(input.texto ?? '').trim()
	if (!content) return { ok: false, error: 'content_required' }
	if (content.length > COMMENT_MAX)
		return { ok: false, error: 'content_too_long' }
	return { ok: true, ref, content }
}

function hasAny(input: Record<string, unknown>, ...keys: string[]) {
	return keys.some((key) => Object.prototype.hasOwnProperty.call(input, key))
}

function readNullableString(
	input: Record<string, unknown>,
	key: string,
): string | null | 'invalid' {
	const value = input[key]
	if (value == null) return null
	if (typeof value !== 'string') return 'invalid'
	const trimmed = value.trim()
	return trimmed ? trimmed : null
}
