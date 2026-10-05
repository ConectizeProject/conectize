import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getBlingClientForCurrentUser } from '@/lib/integrations/bling/api'
import { blingCatalogSyncErrorMessage } from '@/lib/integrations/bling/catalog-sync-rules'
import { advanceBlingCatalogSync, readBlingCatalogSync } from '@/lib/integrations/bling/catalog-sync'
import {
	BLING_CATALOG_SYNC_ACTIONS,
	type BlingCatalogSyncAction,
} from '@/lib/integrations/bling/catalog-sync-types'
import { blingRefreshTokenErrorToMessage } from '@/lib/integrations/bling/refresh-token-errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAction (value: unknown): value is BlingCatalogSyncAction {
	return typeof value === 'string'
		&& (BLING_CATALOG_SYNC_ACTIONS as readonly string[]).includes(value)
}

export async function GET () {
	const auth = await requireAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error, message: blingRefreshTokenErrorToMessage(auth.error) },
			{ status: auth.status },
		)
	}

	try {
		const view = await readBlingCatalogSync(auth.supabase, auth.organizationId)
		return NextResponse.json(view)
	} catch (err) {
		console.error('[bling-catalog-sync] GET', err)
		const message = blingCatalogSyncErrorMessage(err instanceof Error ? err.message : 'db_error')
		return NextResponse.json({ ok: false, status: 'error', message, errorMessage: message })
	}
}

export async function POST (request: Request) {
	const auth = await requireAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error, message: blingRefreshTokenErrorToMessage(auth.error) },
			{ status: auth.status },
		)
	}

	const body = await request.json().catch(() => ({})) as { action?: unknown }
	const action = isAction(body.action) ? body.action : 'start'

	let clientRes
	try {
		clientRes = await getBlingClientForCurrentUser()
	} catch (err) {
		const error = err instanceof Error ? err.message : 'bling_not_connected'
		const isAuthError = /invalid_token|invalid_grant|no_refresh_token|bling_access_token_missing/i.test(error)
		return NextResponse.json({
			ok: false,
			status: 'error',
			error,
			message: blingCatalogSyncErrorMessage(error),
			errorMessage: blingCatalogSyncErrorMessage(error),
		}, { status: isAuthError ? 401 : 400 })
	}
	if (!clientRes.ok || !('client' in clientRes)) {
		const error = 'error' in clientRes ? clientRes.error : 'bling_not_connected'
		return NextResponse.json({
			ok: false,
			status: 'error',
			error,
			message: blingRefreshTokenErrorToMessage(error),
		}, { status: 400 })
	}

	try {
		const view = await advanceBlingCatalogSync({
			supabase: auth.supabase,
			organizationId: auth.organizationId,
			actorUserId: auth.userId,
			client: clientRes.client,
			action,
		})
		return NextResponse.json(view)
	} catch (err) {
		console.error('[bling-catalog-sync] POST', err)
		const raw = err instanceof Error ? err.message : 'unknown_error'
		const message = blingCatalogSyncErrorMessage(raw)
		const isAuthError = /invalid_token|invalid_grant|no_refresh_token|bling_access_token_missing/i.test(raw)
		return NextResponse.json(
			{ ok: false, status: isAuthError ? 'error' : 'paused', error: raw, message, errorMessage: message },
			{ status: isAuthError ? 401 : 200 },
		)
	}
}
