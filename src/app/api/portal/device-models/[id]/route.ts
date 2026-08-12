import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { deviceCatalogOrganizationIds } from '@/lib/organizations/device-catalog'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function cleanText (value: string) {
	return String(value || '').trim()
}

type TypeRow = {
	name?: string | null
	device_brands?: { name?: string | null } | { name?: string | null }[] | null
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
	const deviceTypeId = String(body?.device_type_id ?? body?.deviceTypeId ?? '').trim()
	const model = cleanText(String(body?.model || ''))
	if (!deviceTypeId || !model) {
		return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
	}

	const { data: typeRow, error: typeErr } = await auth.supabase
		.from('device_types')
		.select('id, name, device_brands ( id, name )')
		.eq('id', deviceTypeId)
		.in('organization_id', deviceCatalogOrganizationIds(auth.organizationId))
		.maybeSingle()
	if (typeErr || !typeRow) {
		return NextResponse.json({ ok: false, error: 'invalid_device_type' }, { status: 400 })
	}
	const tr = typeRow as TypeRow
	const db = tr.device_brands
	const brandName = (Array.isArray(db) ? db[0]?.name : db?.name) ?? ''
	const deviceTypeName = tr.name ?? ''
	if (!brandName || !deviceTypeName) {
		return NextResponse.json({ ok: false, error: 'invalid_device_type' }, { status: 400 })
	}

	const { data: updated, error } = await auth.supabase
		.from('device_models')
		.update({ device_type_id: deviceTypeId, model })
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.select('id, model, device_type_id, organization_id')
		.maybeSingle()

	if (error) {
		if (error.code === '23505') {
			return NextResponse.json({ ok: false, error: 'duplicate_model' }, { status: 409 })
		}
		if (error.code === '23503') {
			return NextResponse.json({ ok: false, error: 'invalid_device_type' }, { status: 400 })
		}
		console.error('[device-models PATCH]', error)
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}
	if (!updated) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}

	return NextResponse.json({
		ok: true,
		deviceModel: {
			id: updated.id,
			model: updated.model,
			device_type_id: updated.device_type_id,
			organization_id: updated.organization_id,
			brand: brandName,
			device_type: deviceTypeName,
		},
	})
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
		.from('device_models')
		.delete()
		.eq('id', id)
		.eq('organization_id', auth.organizationId)
		.select('id')
		.maybeSingle()
	if (error) {
		console.error('[device-models DELETE]', error)
		const message = process.env.NODE_ENV === 'development' ? error.message : undefined
		return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
	}
	if (!deleted) {
		return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
	}
	return NextResponse.json({ ok: true })
}
