import { NextResponse } from 'next/server'
import { runMeliRecentOrderReconciliation } from '@/lib/integrations/mercado-livre/scheduled-order-reconciliation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(request: Request): boolean {
	const secret = String(process.env.CRON_SECRET || '').trim()
	if (!secret) return false
	const header = request.headers.get('authorization') || ''
	const bearer = header.toLowerCase().startsWith('bearer ')
		? header.slice(7).trim()
		: ''
	return (
		bearer === secret || request.headers.get('x-cron-secret')?.trim() === secret
	)
}

async function handle(request: Request) {
	if (!String(process.env.CRON_SECRET || '').trim()) {
		return NextResponse.json(
			{ ok: false, error: 'CRON_SECRET não configurado' },
			{ status: 503 },
		)
	}
	if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return NextResponse.json(
			{ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY necessário' },
			{ status: 503 },
		)
	}
	if (!authorized(request))
		return NextResponse.json(
			{ ok: false, error: 'unauthorized' },
			{ status: 401 },
		)

	try {
		const summary = await runMeliRecentOrderReconciliation()
		return NextResponse.json(
			{ ok: summary.failed === 0, ...summary },
			{ status: summary.failed === 0 ? 200 : 500 },
		)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown_error'
		console.error('[meli order reconciliation cron]', message)
		return NextResponse.json({ ok: false, error: message }, { status: 500 })
	}
}

export async function GET(request: Request) {
	return handle(request)
}
export async function POST(request: Request) {
	return handle(request)
}
