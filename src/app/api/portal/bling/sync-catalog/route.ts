import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { syncBlingCatalogForOrganization } from '@/lib/integrations/bling/catalog-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST () {
	const auth = await requireAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const clientRes = await getBlingClientForCurrentUser()
	if (!clientRes.ok || !('client' in clientRes)) {
		const error = 'error' in clientRes ? clientRes.error : 'bling_not_connected'
		return NextResponse.json({ ok: false, error }, { status: 400 })
	}

	try {
		const summary = await syncBlingCatalogForOrganization({
			supabase: auth.supabase,
			organizationId: auth.organizationId,
			actorUserId: auth.userId,
			client: clientRes.client,
		})

		return NextResponse.json({
			ok: true,
			...summary,
			error_message: summary.errors[0] ?? null,
		})
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		return NextResponse.json({ ok: false, error: message }, { status: 500 })
	}
}
