import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function cleanText (value: string) {
	return String(value || '').trim()
}

export async function PATCH (
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}
	const { id: rawId } = await params
	const id = parseOptionalUuid(rawId)
	if (!id) {
		return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
	}
	const body = await request.json().catch(() => null)
	const brandId = String(body?.brandId || body?.brand_id || '').trim()
	const name = cleanText(String(body?.name || ''))
	if (!brandId || !name) {
		return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
	}
	const { data: brandRow } = await auth.supabase
		.from('device_brands')
		.select('id')
		.eq('id', brandId)
		.eq('organization_id', auth.organizationId)
		.maybeSingle()
	if (!brandRow) {
		return NextResponse.json({ ok: false, error: 'invalid_brand' }, { status: 400 })
	}
	const { data, error } = await auth.supabase
		.from('device_types')
		.update({ brand_id: brandId, name })
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.select('id, brand_id, name')
		.maybeSingle()
	if (error) {
		if (error.code === '23505') {
			return NextResponse.json({ ok: false, error: 'duplicate_name' }, { status: 409 })
		}
		if (error.code === '23503') {
			return NextResponse.json({ ok: false, error: 'invalid_brand' }, { status: 400 })
		}
		console.error('[device-types PATCH]', error)
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}
	if (!data) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}
	return NextResponse.json({ ok: true, deviceType: data })
}

export async function DELETE (
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}
	const { id: rawId } = await params
	const id = parseOptionalUuid(rawId)
	if (!id) {
		return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
	}
	const { data: deleted, error } = await auth.supabase
		.from('device_types')
		.delete()
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.select('id')
		.maybeSingle()
	if (error) {
		console.error('[device-types DELETE]', error)
		const message = process.env.NODE_ENV === 'development' ? error.message : undefined
		return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
	}
	if (!deleted) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}
	return NextResponse.json({ ok: true })
}
