import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
	barcodeFromStoredRaw,
	familyIdFromStoredRaw,
	familyNameFromStoredRaw,
	groupMeliListings,
	type MeliListingCard,
	meliListingDisplayFromRaw,
	meliListingGroupMatchesQuery,
	meliListingMetadataFromRaw,
	pickerLabelFromStoredRaw,
	sellerSkuFromStoredRaw,
	userProductIdFromStoredRaw,
	variationsFromStoredRaw,
} from '@/lib/integrations/mercado-livre/listing-variations'

export const dynamic = 'force-dynamic'

const PAGE_SIZE_OPTIONS = [24, 48, 96] as const
const MAX_LISTINGS = 5000

function parsePageSize(raw: string | null): number {
	const n = Number.parseInt(String(raw || ''), 10)
	if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) {
		return n
	}
	return 24
}

function productFromRel(productRel: unknown): {
	id: string
	name: string
	barcode: string | null
	sku: string | null
} | null {
	if (
		Array.isArray(productRel) &&
		productRel[0] &&
		typeof productRel[0] === 'object'
	) {
		const p = productRel[0] as {
			id?: unknown
			name?: unknown
			barcode?: unknown
			sku?: unknown
		}
		if (p.id) {
			return {
				id: String(p.id),
				name: String(p.name || ''),
				barcode: p.barcode ? String(p.barcode) : null,
				sku: p.sku ? String(p.sku) : null,
			}
		}
		return null
	}
	if (productRel && typeof productRel === 'object') {
		const p = productRel as {
			id?: unknown
			name?: unknown
			barcode?: unknown
			sku?: unknown
		}
		if (p.id) {
			return {
				id: String(p.id),
				name: String(p.name || ''),
				barcode: p.barcode ? String(p.barcode) : null,
				sku: p.sku ? String(p.sku) : null,
			}
		}
	}
	return null
}

export async function GET(request: NextRequest) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { searchParams } = request.nextUrl
	const q = String(searchParams.get('q') || '').trim()
	const status = String(searchParams.get('status') || '')
		.trim()
		.toLowerCase()
	const pageSize = parsePageSize(searchParams.get('pageSize'))
	const pageRaw = Number.parseInt(String(searchParams.get('page') || '1'), 10)
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

	let query = auth.supabase
		.from('meli_listings')
		.select(
			'id, ml_item_id, product_id, title, permalink, thumbnail_url, status, price_cents, available_quantity, sold_quantity, seller_sku, synced_at, raw, products(id, name, barcode, sku)',
		)
		.eq('organization_id', auth.organizationId)
		.order('synced_at', { ascending: false })
		.limit(MAX_LISTINGS)

	if (status && status !== 'all') {
		query = query.eq('status', status)
	}

	const { data, error } = await query
	if (error) {
		return NextResponse.json(
			{ ok: false, error: 'db_error', message: error.message },
			{ status: 500 },
		)
	}

	const listings: MeliListingCard[] = (data ?? []).map((row) => {
		const raw = row as Record<string, unknown>
		const mlItemId = String(raw.ml_item_id)
		const permalink = raw.permalink ? String(raw.permalink) : null
		const thumbnailUrl = raw.thumbnail_url ? String(raw.thumbnail_url) : null
		const listingStatus = String(raw.status || 'unknown')
		const product = productFromRel(raw.products)
		const barcode =
			barcodeFromStoredRaw(raw.raw) ?? product?.barcode?.trim() ?? null
		const sellerSku =
			(raw.seller_sku ? String(raw.seller_sku).trim() : null) ||
			sellerSkuFromStoredRaw(raw.raw) ||
			product?.sku?.trim() ||
			null

		const priceCents = raw.price_cents == null ? null : Number(raw.price_cents)
		const display = meliListingDisplayFromRaw(raw.raw, priceCents)
		const meta = meliListingMetadataFromRaw(raw.raw)

		return {
			id: String(raw.id),
			ml_item_id: mlItemId,
			product_id: raw.product_id ? String(raw.product_id) : null,
			title: String(raw.title || ''),
			permalink,
			thumbnail_url: thumbnailUrl,
			status: listingStatus,
			price_cents: priceCents,
			original_price_cents: display.original_price_cents,
			stock_full: display.stock_full,
			stock_deposito: display.stock_deposito,
			flex_status: display.flex_status,
			flex_aggregate_status: display.flex_aggregate_status,
			available_quantity:
				raw.available_quantity == null ? null : Number(raw.available_quantity),
			sold_quantity:
				raw.sold_quantity == null ? null : Number(raw.sold_quantity),
			seller_sku: sellerSku,
			barcode,
			synced_at: String(raw.synced_at),
			user_product_id: userProductIdFromStoredRaw(raw.raw),
			family_id: familyIdFromStoredRaw(raw.raw),
			family_name: familyNameFromStoredRaw(raw.raw),
			picker_label: pickerLabelFromStoredRaw(raw.raw),
			variations: variationsFromStoredRaw({
				raw: raw.raw,
				mlItemId,
				permalink,
				thumbnailUrl,
				status: listingStatus,
			}),
			product,
			meta,
		}
	})

	const groups = groupMeliListings(listings).filter((group) =>
		meliListingGroupMatchesQuery(group, q),
	)
	const total = groups.length
	const from = (page - 1) * pageSize
	const pageGroups = groups.slice(from, from + pageSize)

	return NextResponse.json({
		ok: true,
		groups: pageGroups,
		listings: pageGroups.map((group) => group.listing),
		page,
		pageSize,
		total,
	})
}
