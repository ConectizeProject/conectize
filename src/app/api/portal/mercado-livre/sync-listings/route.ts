import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { syncMeliListingsForOrganization } from '@/lib/integrations/mercado-livre/listing-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
	const auth = await requireAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	try {
		const summary = await syncMeliListingsForOrganization({
			supabase: auth.supabase,
			organizationId: auth.organizationId,
		})

		return NextResponse.json({
			ok: true,
			...summary,
			error_message: summary.errors[0] ?? null,
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		const status =
			message === 'meli_not_connected' ||
			message === 'meli_user_id_missing_in_connection'
				? 400
				: 500
		return NextResponse.json({ ok: false, error: message }, { status })
	}
}
