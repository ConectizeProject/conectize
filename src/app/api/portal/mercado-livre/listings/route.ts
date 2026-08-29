import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export const dynamic = 'force-dynamic'

const PAGE_SIZE_OPTIONS = [24, 48, 96] as const

function parsePageSize(raw: string | null): number {
	const n = Number.parseInt(String(raw || ''), 10)
	if (PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])) {
		return n
	}
	return 24
}

export type MeliListingListRow = {
	id: string
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
	synced_at: string
	product?: { id: string; name: string } | null
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
	const from = (page - 1) * pageSize
	const to = from + pageSize - 1

	let query = auth.supabase
		.from('meli_listings')
		.select(
			'id, ml_item_id, product_id, title, permalink, thumbnail_url, status, price_cents, available_quantity, sold_quantity, seller_sku, synced_at, products(id, name)',
			{ count: 'exact' },
		)
		.eq('organization_id', auth.organizationId)
		.order('synced_at', { ascending: false })
		.range(from, to)

	if (status && status !== 'all') {
		query = query.eq('status', status)
	}

	if (q) {
		const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
		query = query.or(
			`title.ilike.%${escaped}%,seller_sku.ilike.%${escaped}%,ml_item_id.ilike.%${escaped}%`,
		)
	}

	const { data, error, count } = await query
	if (error) {
		return NextResponse.json(
			{ ok: false, error: 'db_error', message: error.message },
			{ status: 500 },
		)
	}

	const listings = (data ?? []).map((row) => {
		const raw = row as Record<string, unknown>
		const productRel = raw.products
		let product: { id: string; name: string } | null = null
		if (
			Array.isArray(productRel) &&
			productRel[0] &&
			typeof productRel[0] === 'object'
		) {
			const p = productRel[0] as { id?: unknown; name?: unknown }
			if (p.id) product = { id: String(p.id), name: String(p.name || '') }
		} else if (
			productRel &&
			typeof productRel === 'object' &&
			!Array.isArray(productRel)
		) {
			const p = productRel as { id?: unknown; name?: unknown }
			if (p.id) product = { id: String(p.id), name: String(p.name || '') }
		}

		return {
			id: String(raw.id),
			ml_item_id: String(raw.ml_item_id),
			product_id: raw.product_id ? String(raw.product_id) : null,
			title: String(raw.title || ''),
			permalink: raw.permalink ? String(raw.permalink) : null,
			thumbnail_url: raw.thumbnail_url ? String(raw.thumbnail_url) : null,
			status: String(raw.status || 'unknown'),
			price_cents: raw.price_cents == null ? null : Number(raw.price_cents),
			available_quantity:
				raw.available_quantity == null ? null : Number(raw.available_quantity),
			sold_quantity:
				raw.sold_quantity == null ? null : Number(raw.sold_quantity),
			seller_sku: raw.seller_sku ? String(raw.seller_sku) : null,
			synced_at: String(raw.synced_at),
			product,
		} satisfies MeliListingListRow
	})

	return NextResponse.json({
		ok: true,
		listings,
		page,
		pageSize,
		total: count ?? listings.length,
	})
}
