import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { syncBlingCatalogPage } from '@/lib/integrations/bling/catalog-sync'

export async function POST (request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}

	const body = await request.json().catch(() => ({})) as { page?: number; limit?: number }
	const page = Number(body.page || 1)
	const limit = Math.min(Number(body.limit || 50), 100)

	const clientRes = await getBlingClientForCurrentUser()
	if (!clientRes.ok || !('client' in clientRes)) {
		const error = 'error' in clientRes ? clientRes.error : 'bling_client_unavailable'
		return NextResponse.json({ ok: false, error }, { status: 400 })
	}

	try {
		const { imported, updated, fetched } = await syncBlingCatalogPage({
			supabase: auth.supabase,
			organizationId: auth.organizationId,
			actorUserId: auth.userId,
			client: clientRes.client,
			page,
			limit,
		})

		return NextResponse.json({ ok: true, imported, updated, fetched })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		if (message === 'db_error') {
			return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
		}
		return NextResponse.json({ ok: false, error: 'bling_request_failed', message }, { status: 502 })
	}
}
