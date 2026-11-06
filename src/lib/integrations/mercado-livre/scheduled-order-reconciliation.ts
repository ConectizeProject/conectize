import type { SupabaseClient } from '@supabase/supabase-js'
import type { HubConnection } from '@/lib/integrations/mercado-livre/api'
import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import { reconcileRecentMeliOrders } from '@/lib/integrations/mercado-livre/recent-orders'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type ConnectionWithOrganization = HubConnection & { organization_id: string }

export async function runMeliRecentOrderReconciliation(
	supabase: SupabaseClient = createSupabaseServiceClient(),
) {
	const { data, error } = await supabase
		.from('hub_connections')
		.select(
			'id, organization_id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
		)
		.eq('platform_id', MELI_PLATFORM_ID)
		.not('access_token', 'is', null)
	if (error) throw new Error(error.message || 'meli_connections_query_failed')

	const organizations = [
		...new Set(
			(data || [])
				.map((row) =>
					String(
						(row as ConnectionWithOrganization).organization_id || '',
					).trim(),
				)
				.filter(Boolean),
		),
	]
	const results: Array<{
		organizationId: string
		imported: number
		failed: number
		created: number
		verified: number
		ordersFound: number
		error?: string
	}> = []

	for (const organizationId of organizations) {
		try {
			const summary = await reconcileRecentMeliOrders({
				supabase,
				organizationId,
			})
			results.push({ organizationId, ...summary })
		} catch (err) {
			results.push({
				organizationId,
				imported: 0,
				failed: 0,
				created: 0,
				verified: 0,
				ordersFound: 0,
				error: err instanceof Error ? err.message : 'unknown_error',
			})
		}
	}

	return {
		checked: organizations.length,
		imported: results.reduce((sum, row) => sum + row.imported, 0),
		failed: results.reduce(
			(sum, row) => sum + row.failed + (row.error ? 1 : 0),
			0,
		),
		created: results.reduce((sum, row) => sum + row.created, 0),
		verified: results.reduce((sum, row) => sum + row.verified, 0),
		ordersFound: results.reduce((sum, row) => sum + row.ordersFound, 0),
		results,
	}
}
