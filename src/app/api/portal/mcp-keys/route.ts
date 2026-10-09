import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { generateMcpToken } from '@/lib/mcp/token'

const KEY_FIELDS = 'id, label, created_at, last_used_at, revoked_at, user_id'

export async function GET() {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { data, error } = await auth.supabase
		.from('mcp_api_keys')
		.select(KEY_FIELDS)
		.eq('organization_id', auth.organizationId)
		.order('created_at', { ascending: false })

	if (error) {
		console.error('[mcp-keys GET]', error)
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}

	return NextResponse.json({
		ok: true,
		keys: data ?? [],
		actorUserId: auth.userId,
		isAdmin: auth.isAdmin,
	})
}

export async function POST(request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const body = await request.json().catch(() => null)
	const label = String((body as { label?: unknown } | null)?.label ?? '').trim()
	if (label.length < 1 || label.length > 80) {
		return NextResponse.json(
			{ ok: false, error: 'label_invalid' },
			{ status: 400 },
		)
	}

	const { token, tokenHash } = generateMcpToken()
	const { data, error } = await auth.supabase
		.from('mcp_api_keys')
		.insert({
			organization_id: auth.organizationId,
			user_id: auth.userId,
			label,
			token_hash: tokenHash,
		})
		.select(KEY_FIELDS)
		.maybeSingle()

	if (error || !data) {
		console.error('[mcp-keys POST]', error)
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}

	return NextResponse.json({ ok: true, key: data, token })
}
