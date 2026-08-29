import type { SupabaseClient } from '@supabase/supabase-js'
import {
	getMeliConnectionByOrganizationId,
	getMeliItemsMultiget,
	type HubConnection,
	searchSellerItemIds,
} from '@/lib/integrations/mercado-livre/api'
import { mapMeliItemToListingRow } from '@/lib/integrations/mercado-livre/listing-mapper'
import { resolveMeliProductFromItemPayload } from '@/lib/integrations/mercado-livre/product-resolve'
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
 * e vincula/cria produtos locais.
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

	const syncedAt = new Date().toISOString()

	for (const item of items) {
		try {
			const resolved = await resolveMeliProductFromItemPayload({
				supabase: params.supabase,
				organizationId: params.organizationId,
				createdBy: actorUserId,
				itemPayload: item,
			})

			if (resolved.created) summary.productsCreated += 1
			else if (resolved.linked) summary.productsLinked += 1

			const row = mapMeliItemToListingRow({
				organizationId: params.organizationId,
				item,
				productId: resolved.productId,
				syncedAt,
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
			const id =
				item && typeof item === 'object' && 'id' in item
					? String((item as { id: unknown }).id)
					: '?'
			summary.errors.push(`${id}: ${message}`)
		}
	}

	return summary
}
