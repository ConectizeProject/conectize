import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const { id: rawId } = await params
	const id = parseOptionalUuid(rawId)
	if (!id) {
		return NextResponse.json(
			{ ok: false, error: 'invalid_id' },
			{ status: 400 },
		)
	}

	const { data, error } = await auth.supabase
		.from('mcp_api_keys')
		.update({ revoked_at: new Date().toISOString() })
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.is('revoked_at', null)
		.select('id')
		.maybeSingle()

	if (error) {
		console.error('[mcp-keys DELETE]', error)
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}
	if (!data) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}

	return NextResponse.json({ ok: true })
}
