import type { SupabaseClient } from '@supabase/supabase-js'
import { blingProdutoApiPath } from '@/lib/integrations/bling/api'
import {
	buildParentNameByBlingIdFromPageItems,
	mapBlingProductToLocal,
	type LocalProduct,
} from '@/lib/integrations/bling/mappers'
import { createProductSyncSnapshot } from '@/lib/products/bling-sync'
import { allocateCatalogSortKeyForInsert } from '@/lib/products/catalog-sort-key'

export type BlingRequestClient = {
	request: <T = unknown>(options: {
		method?: 'GET'
		path: string
		query?: Record<string, string | number | string[] | number[]>
	}) => Promise<T>
}

export type BlingListResponse = {
	data?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
	itens?: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>
}

export type MappedLocal = ReturnType<typeof mapBlingProductToLocal>

export type BlingProductUpsertResult = {
	action: 'created' | 'updated' | 'invalid'
	productId?: string
	productName?: string
	blingId?: string
}

function getCurrentStock (
	rows: Array<{ type: string; quantity: number }> | null | undefined,
): number {
	if (!rows || !Array.isArray(rows)) return 0
	let balance = 0
	for (const row of rows) {
		const type = String(row.type || '').toLowerCase()
		const qty = Number(row.quantity) || 0
		if (type === 'entry') balance += qty
		else if (type === 'exit' || type === 'loss') balance -= qty
	}
	return balance
}

function applyFiscalFieldsToPayload (
	payload: Record<string, unknown>,
	local: LocalProduct,
) {
	if (local.ncm !== undefined) payload.ncm = local.ncm
	if (local.cest !== undefined) payload.cest = local.cest
	if (local.cfop !== undefined) payload.cfop = local.cfop
	if (local.fiscalOrigin !== undefined) payload.fiscal_origin = local.fiscalOrigin
	if (local.fiscalUnit !== undefined) payload.fiscal_unit = local.fiscalUnit
	if (local.icmsCsosn !== undefined) payload.icms_csosn = local.icmsCsosn
	if (local.icmsCst !== undefined) payload.icms_cst = local.icmsCst
	if (local.pisCst !== undefined) payload.pis_cst = local.pisCst
	if (local.cofinsCst !== undefined) payload.cofins_cst = local.cofinsCst
}

function extractListDto (
	raw: { produto?: Record<string, unknown> } | Record<string, unknown>,
): Record<string, unknown> {
	return (raw as { produto?: Record<string, unknown> })?.produto ?? (raw as Record<string, unknown>)
}

/**
 * A listagem GET /produtos omite campos detalhados (ex.: gtin / codigoBarras).
 * Buscamos GET /produtos/{id} para gravar barcode e demais dados completos.
 */
export async function enrichListItemsWithDetails (
	client: BlingRequestClient,
	items: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>,
): Promise<Array<{ dto: Record<string, unknown>; local: MappedLocal }>> {
	const parentNames = buildParentNameByBlingIdFromPageItems(items)
	const mapCtx = { parentNameByBlingId: parentNames }
	const enriched: Array<{ dto: Record<string, unknown>; local: MappedLocal }> = []

	for (const raw of items) {
		const listDto = extractListDto(raw)
		const blingId = listDto.id != null ? String(listDto.id).trim() : ''
		let dto = listDto

		if (blingId) {
			try {
				const detail = await client.request<{ data?: Record<string, unknown> } | Record<string, unknown>>({
					method: 'GET',
					path: blingProdutoApiPath(blingId),
				})
				const detailData =
					detail && typeof detail === 'object' && 'data' in detail && detail.data
						? (detail.data as Record<string, unknown>)
						: (detail as Record<string, unknown>)
				if (detailData && typeof detailData === 'object') {
					dto = detailData
				}
			} catch {
				// mantém payload da listagem se o detalhe falhar
			}
		}

		enriched.push({
			dto,
			local: mapBlingProductToLocal(dto, blingId || null, mapCtx),
		})
	}

	return enriched
}

export async function upsertBlingProductForOrganization (params: {
	supabase: SupabaseClient
	organizationId: string
	userId: string
	local: MappedLocal
	externalReference: string
}): Promise<BlingProductUpsertResult> {
	const { supabase, organizationId, userId, local, externalReference } = params
	const blingId = String(local.blingId || '').trim()
	if (!blingId || !String(local.name || '').trim()) {
		return { action: 'invalid', blingId: blingId || undefined }
	}

	const estoqueAtual = typeof local.estoqueAtual === 'number' && local.estoqueAtual >= 0
		? local.estoqueAtual
		: 0
	const unitCents =
		local.costPriceCents != null && local.costPriceCents > 0
			? local.costPriceCents
			: (local.salePriceCents ?? 0)

	const payload: Record<string, unknown> = {
		organization_id: organizationId,
		bling_id: blingId,
		bling_sync_pending: false,
		bling_sync_snapshot: createProductSyncSnapshot(local),
		parent_bling_id: local.parentBlingId ?? null,
		name: local.name,
		sku: local.sku,
		barcode: local.barcode,
		description: local.description,
		image_url: local.imageUrl ?? null,
		sale_price_cents: local.salePriceCents,
		cost_price_cents: local.costPriceCents,
		is_active: local.isActive ?? true,
		kind: local.kind ?? null,
		created_by: userId,
	}
	applyFiscalFieldsToPayload(payload, local)

	const isVariation = Boolean(
		local.parentBlingId != null && String(local.parentBlingId).trim(),
	)
	if (isVariation && local.variationAttributeValues) {
		payload.variation_attribute_values = local.variationAttributeValues
		payload.variation_attribute_keys = []
	}

	const mergeParentKeys = async () => {
		if (!isVariation || !local.variationAttributeKeys?.length) return
		const parentBling = String(local.parentBlingId).trim()
		const { data: parent } = await supabase
			.from('products')
			.select('id, variation_attribute_keys')
			.eq('organization_id', organizationId)
			.eq('bling_id', parentBling)
			.maybeSingle()
		if (!parent?.id) return
		const existingKeys = Array.isArray(parent.variation_attribute_keys)
			? parent.variation_attribute_keys.map((k: unknown) => String(k || '').trim()).filter(Boolean)
			: []
		const seen = new Set(existingKeys.map((k: string) => k.toLowerCase()))
		const merged = [...existingKeys]
		for (const k of local.variationAttributeKeys) {
			const label = String(k || '').trim()
			if (!label) continue
			const low = label.toLowerCase()
			if (seen.has(low)) continue
			seen.add(low)
			merged.push(label)
		}
		if (merged.length === existingKeys.length && existingKeys.length > 0) return
		await supabase
			.from('products')
			.update({
				variation_attribute_keys: merged,
				updated_at: new Date().toISOString(),
			})
			.eq('id', parent.id)
	}

	const { data: existing } = await supabase
		.from('products')
		.select('id')
		.eq('organization_id', organizationId)
		.eq('bling_id', blingId)
		.maybeSingle()

	if (existing?.id) {
		const updatePayload: Record<string, unknown> = {
			parent_bling_id: payload.parent_bling_id,
			name: payload.name,
			sku: payload.sku,
			barcode: payload.barcode,
			description: payload.description,
			image_url: payload.image_url,
			sale_price_cents: payload.sale_price_cents,
			cost_price_cents: payload.cost_price_cents,
			is_active: payload.is_active,
			kind: payload.kind,
			bling_sync_pending: false,
			bling_sync_snapshot: payload.bling_sync_snapshot,
			updated_at: new Date().toISOString(),
		}
		if (isVariation && local.variationAttributeValues) {
			updatePayload.variation_attribute_values = local.variationAttributeValues
			updatePayload.variation_attribute_keys = []
		}
		applyFiscalFieldsToPayload(updatePayload, local)

		const { error: updateErr } = await supabase
			.from('products')
			.update(updatePayload)
			.eq('id', existing.id)
		if (updateErr) {
			throw new Error('db_error')
		}

		await mergeParentKeys()

		const { data: movements } = await supabase
			.from('product_stock_movements')
			.select('type, quantity')
			.eq('product_id', existing.id)
		const currentStock = getCurrentStock((movements || []) as Array<{ type: string; quantity: number }>)
		const diff = estoqueAtual - currentStock
		if (diff !== 0) {
			await supabase
				.from('product_stock_movements')
				.insert({
					organization_id: organizationId,
					product_id: existing.id,
					type: diff > 0 ? 'entry' : 'exit',
					quantity: Math.abs(diff),
					unit_value_cents: unitCents,
					total_value_cents: Math.abs(diff) * unitCents,
					source: 'bling',
					external_reference: externalReference,
					created_by: userId,
				})
		}

		return {
			action: 'updated',
			productId: existing.id,
			productName: local.name,
			blingId,
		}
	}

	const catalogSortKey = await allocateCatalogSortKeyForInsert(supabase, {
		parentBlingId: payload.parent_bling_id as string | null,
	})
	const { data: inserted, error: insertErr } = await supabase
		.from('products')
		.insert({ ...payload, catalog_sort_key: catalogSortKey })
		.select('id')
		.single()
	if (insertErr || !inserted?.id) {
		throw new Error('db_error')
	}

	await mergeParentKeys()

	if (estoqueAtual > 0) {
		await supabase
			.from('product_stock_movements')
			.insert({
				organization_id: organizationId,
				product_id: inserted.id,
				type: 'entry',
				quantity: estoqueAtual,
				unit_value_cents: unitCents,
				total_value_cents: estoqueAtual * unitCents,
				source: 'bling',
				external_reference: externalReference,
				created_by: userId,
			})
	}

	return {
		action: 'created',
		productId: inserted.id,
		productName: local.name,
		blingId,
	}
}
