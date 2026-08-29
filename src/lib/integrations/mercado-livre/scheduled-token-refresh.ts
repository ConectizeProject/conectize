import {
	type HubConnection,
	performMeliTokenRefresh,
	shouldRefreshMeliAccessToken,
} from '@/lib/integrations/mercado-livre/api'
import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export type MeliScheduledRefreshSummary = {
	checked: number
	refreshed: number
	skipped: number
	failed: Array<{ id: string; error: string }>
}

export async function runMeliTokenRefreshForAllConnections(): Promise<MeliScheduledRefreshSummary> {
	const supabase = createSupabaseServiceClient()

	const { data: rows, error } = await supabase
		.from('hub_connections')
		.select(
			'id, platform_id, access_token, refresh_token, token_expires_at, metadata, created_by',
		)
		.eq('platform_id', MELI_PLATFORM_ID)
		.not('refresh_token', 'is', null)

	if (error) {
		throw new Error(error.message || 'hub_connections_query_failed')
	}

	const list = (rows || []) as HubConnection[]
	const failed: MeliScheduledRefreshSummary['failed'] = []
	let refreshed = 0
	let skipped = 0

	for (const conn of list) {
		if (!shouldRefreshMeliAccessToken(conn.token_expires_at)) {
			skipped++
			continue
		}

		try {
			const result = await performMeliTokenRefresh(conn, { supabase })
			if (result.ok === true) {
				refreshed++
			} else {
				failed.push({ id: conn.id, error: result.error })
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'unexpected_refresh_exception'
			failed.push({ id: conn.id, error: message })
		}
	}

	return {
		checked: list.length,
		refreshed,
		skipped,
		failed,
	}
}
