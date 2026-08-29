import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import { normalizeMeliUserId } from '@/lib/integrations/mercado-livre/webhooks'
import type { createSupabaseServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

type HubConnectionRow = {
	id: string
	organization_id: string
	metadata: unknown
}

function userIdFromMetadata(metadata: unknown): string | null {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
		return null
	return normalizeMeliUserId((metadata as Record<string, unknown>).user_id)
}

async function listMeliConnections(
	supabase: ServiceClient,
): Promise<HubConnectionRow[]> {
	const { data } = await supabase
		.from('hub_connections')
		.select('id, organization_id, metadata')
		.eq('platform_id', MELI_PLATFORM_ID)
		.order('updated_at', { ascending: false })
		.limit(200)

	return (data || []) as HubConnectionRow[]
}

/**
 * Resolve a organização pelo `user_id` (Int64) da notificação, comparado a
 * `hub_connections.metadata.user_id` (sempre string).
 */
export async function resolveMeliWebhookOrganizationId(
	supabase: ServiceClient,
	userIdRaw: string | null,
): Promise<string | null> {
	const userId = normalizeMeliUserId(userIdRaw)
	if (!userId) return null

	const connections = await listMeliConnections(supabase)
	for (const row of connections) {
		const stored = userIdFromMetadata(row.metadata)
		if (stored && stored === userId && row.organization_id) {
			return String(row.organization_id)
		}
	}

	return null
}
