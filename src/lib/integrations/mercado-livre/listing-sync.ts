import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	getMeliItemsMultiget,
	type HubConnection,
	loadMeliItemMetadataById,
	loadMeliItemsWithAttributes,
	loadMeliUserProductDetailsById,
	type MeliUserProductDetails,
	searchSellerItemIds,
} from '@/lib/integrations/mercado-livre/api'
import { mapMeliItemToListingRow } from '@/lib/integrations/mercado-livre/listing-mapper'
import {
	familyIdFromMeliItem,
	familyNameFromMeliItem,
	userProductIdFromMeliItem,
} from '@/lib/integrations/mercado-livre/listing-variations'
import {
	extractSellerSkuFromMeliItem,
	resolveMeliProductFromItemPayload,
} from '@/lib/integrations/mercado-livre/product-resolve'
import { normalizeMeliUserId } from '@/lib/integrations/mercado-livre/webhooks'

export type MeliListingSyncSummary = {
	fetched: number
	upserted: number
	productsCreated: number
	productsLinked: number
	skipped: number
	errors: string[]
	truncated: boolean
}

function trimText(value: unknown): string | null {
	if (value == null) return null
	const s = String(value).trim()
	return s || null
}

function mergeMeliItemSku(
	item: Record<string, unknown>,
	sellerSku: string | null,
): Record<string, unknown> {
	if (!sellerSku || extractSellerSkuFromMeliItem(item)) return item
	return { ...item, seller_sku: sellerSku }
}

function enrichItemWithUserProductDetails(
	item: Record<string, unknown>,
	details: MeliUserProductDetails | undefined,
): Record<string, unknown> {
	if (!details) return item
	let next = item
	if (
		details.family_id &&
		(!familyIdFromMeliItem(item) || !familyNameFromMeliItem(item))
	) {
		next = {
			...next,
			family_id: familyIdFromMeliItem(item) ?? details.family_id,
			family_name: familyNameFromMeliItem(item) ?? details.family_name,
		}
	}
	return mergeMeliItemSku(next, details.seller_sku)
}

async function resolveActorUserId(
	supabase: SupabaseClient,
	organizationId: string,
	connection: HubConnection,
): Promise<string | null> {
	if (connection.created_by) return String(connection.created_by)

	const { data: admin } = await supabase
		.from('organization_members')
		.select('user_id, users!inner(role)')
		.eq('organization_id', organizationId)
		.eq('users.role', 'admin')
		.limit(1)
		.maybeSingle()
	if (admin?.user_id) return String(admin.user_id)

	const { data: staff } = await supabase
		.from('organization_members')
		.select('user_id, users!inner(role)')
		.eq('organization_id', organizationId)
		.eq('users.role', 'staff')
		.limit(1)
		.maybeSingle()
	return staff?.user_id ? String(staff.user_id) : null
}

function userIdFromConnection(connection: HubConnection): string | null {
	const meta =
		connection.metadata && typeof connection.metadata === 'object'
			? connection.metadata
			: null
	return normalizeMeliUserId(meta?.user_id)
}

/**
 * Busca todos os anúncios do seller na API ML, upsert em `meli_listings`
 * (sempre com SKU quando disponível) e vincula/cria produtos locais quando possível.
 */
export async function syncMeliListingsForOrganization(params: {
	supabase: SupabaseClient
	organizationId: string
}): Promise<MeliListingSyncSummary> {
	const summary: MeliListingSyncSummary = {
		fetched: 0,
		upserted: 0,
		productsCreated: 0,
		productsLinked: 0,
		skipped: 0,
		errors: [],
		truncated: false,
	}

	const connection = await getMeliConnectionByOrganizationId(
		params.supabase,
		params.organizationId,
	)
	if (!connection) {
		throw new Error('meli_not_connected')
	}

	const userId = userIdFromConnection(connection)
	if (!userId) {
		throw new Error('meli_user_id_missing_in_connection')
	}

	const actorUserId = await resolveActorUserId(
		params.supabase,
		params.organizationId,
		connection,
	)

	const itemIds = await searchSellerItemIds(connection, userId, params.supabase)
	summary.fetched = itemIds.length
	summary.truncated = itemIds.length >= 5000

	if (itemIds.length === 0) return summary

	const items = await getMeliItemsMultiget(connection, itemIds, params.supabase)
	const userProductIds = items
		.map((item) => userProductIdFromMeliItem(item))
		.filter((id): id is string => Boolean(id))
	const userProductsById = await loadMeliUserProductDetailsById(
		connection,
		userProductIds,
		params.supabase,
	)

	const missingSkuItemIds = items
		.filter((item) => !extractSellerSkuFromMeliItem(item))
		.map((item) => trimText(item.id))
		.filter((id): id is string => Boolean(id))
	const itemsWithAttributes = await loadMeliItemsWithAttributes(
		connection,
		missingSkuItemIds,
		params.supabase,
	)
	const itemMetadataById = await loadMeliItemMetadataById(
		connection,
		itemIds,
		params.supabase,
	)

	const syncedAt = new Date().toISOString()

	for (const item of items) {
		const mlItemId = trimText(item.id) ?? '?'
		try {
			const userProductId = userProductIdFromMeliItem(item)
			const userProduct = userProductId
				? userProductsById.get(userProductId)
				: undefined
			const detailedItem = mlItemId
				? itemsWithAttributes.get(mlItemId)
				: undefined
			const itemEnriched = enrichItemWithUserProductDetails(
				detailedItem ? { ...item, ...detailedItem } : item,
				userProduct,
			)

			let productId: string | null = null
			try {
				const resolved = await resolveMeliProductFromItemPayload({
					supabase: params.supabase,
					organizationId: params.organizationId,
					createdBy: actorUserId,
					itemPayload: itemEnriched,
				})
				if (resolved?.created) summary.productsCreated += 1
				else if (resolved?.linked) summary.productsLinked += 1
				productId = resolved?.productId ?? null
			} catch (linkErr) {
				const message =
					linkErr instanceof Error ? linkErr.message : 'product_link_failed'
				summary.errors.push(`${mlItemId}: link: ${message}`)
			}

			const metadataExtras = mlItemId
				? itemMetadataById.get(mlItemId)
				: undefined
			const row = mapMeliItemToListingRow({
				organizationId: params.organizationId,
				item: itemEnriched,
				productId,
				syncedAt,
				stockLocations: userProduct?.stock_locations,
				pricesPayload: metadataExtras?.pricesPayload,
				descriptionPayload: metadataExtras?.descriptionPayload,
			})
			if (!row) {
				summary.skipped += 1
				continue
			}

			const { error } = await params.supabase
				.from('meli_listings')
				.upsert(row, { onConflict: 'organization_id,ml_item_id' })

			if (error) {
				summary.errors.push(
					`${row.ml_item_id}: ${error.message || 'upsert_failed'}`,
				)
				continue
			}
			summary.upserted += 1
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown_error'
			summary.errors.push(`${mlItemId}: ${message}`)
		}
	}

	return summary
}
