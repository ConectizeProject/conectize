import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { importMeliOrdersFromLastWeek } from '@/lib/integrations/mercado-livre/recent-orders'
import { meliRefreshTokenErrorToMessage } from '@/lib/integrations/mercado-livre/refresh-token-errors'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
	const auth = await requireAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{
				ok: false,
				error: auth.error,
				message: meliRefreshTokenErrorToMessage(auth.error),
			},
			{ status: auth.status },
		)
	}

	try {
		const summary = await importMeliOrdersFromLastWeek({
			supabase: createSupabaseServiceClient(),
			organizationId: auth.organizationId,
		})

		return NextResponse.json({
			ok: true,
			imported: summary.imported,
			failed: summary.failed,
			created: summary.created,
			verified: summary.verified,
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		console.error('[meli sync-orders]', message)
		const isAuthError =
			message === 'meli_not_connected' ||
			message === 'meli_user_id_missing_in_connection' ||
			/invalid_token|invalid_grant|no_refresh_token|meli_access_token_missing|meli_oauth_not_configured/i.test(
				message,
			)
		return NextResponse.json(
			{
				ok: false,
				error: message,
				message: meliRefreshTokenErrorToMessage(message),
			},
			{ status: isAuthError ? 400 : 500 },
		)
	}
}
