import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

function cleanText(value: string) {
	return String(value || '').trim()
}

/** Evita `%` / `_` literais quebrarem o padrão do `ilike`. */
function escapeIlikePattern(value: string) {
	return String(value || '')
		.replace(/\\/g, '\\\\')
		.replace(/%/g, '\\%')
		.replace(/_/g, '\\_')
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Dt = { name?: string | null; device_brands?: { name?: string | null } | { name?: string | null }[] | null }
type ModelRow = {
	id: string
	model?: string | null
	device_type_id?: string
	device_types?: Dt | Dt[] | null
}

function mapDeviceModelRows(data: ModelRow[] | null) {
	return (data || []).map((row) => {
		const dt = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
		const br = dt?.device_brands
		const brand = Array.isArray(br) ? br[0] : br
		return {
			id: row.id,
			model: row.model,
			device_type_id: row.device_type_id,
			brand: brand?.name ?? null,
			device_type: dt?.name ?? null,
		}
	})
}

const DEVICE_MODEL_LIST_SELECT =
	'id, model, device_type_id, device_types ( id, name, device_brands ( id, name ) )'

/** Palavras comuns que sozinhas geram ruído em `ilike` (AND). */
const MODEL_SEARCH_STOPWORDS = new Set([
	'de', 'da', 'do', 'para', 'com', 'sem', 'celular', 'smartphone', 'aparelho', 'original',
])

function modelSearchTokens(raw: string): string[] {
	const parts = String(raw || '')
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
		.filter((t) => t.length >= 2 && !MODEL_SEARCH_STOPWORDS.has(t))
	return [...new Set(parts)]
}

/**
 * Busca modelos por texto: frase inteira na coluna `model`, AND por tokens (ex.: iphone + 11),
 * string sem espaços, e OR modelo/marca (marca vem do join).
 */
async function searchDeviceModelsByText(
	supabase: SupabaseClient,
	organizationId: string,
	q: string,
	deviceTypeId: string,
	limit: number,
): Promise<ModelRow[]> {
	const safe = escapeIlikePattern(q)
	const tokens = modelSearchTokens(q)
	const compactRaw = q.replace(/\s+/g, '').trim()
	const compact = compactRaw.length >= 4 ? escapeIlikePattern(compactRaw) : ''

	const perBranch = Math.min(160, Math.max(limit, 80))
	const byId = new Map<string, ModelRow>()

	const merge = (data: ModelRow[] | null) => {
		for (const row of data || []) {
			const id = String((row as ModelRow).id)
			if (!byId.has(id)) byId.set(id, row as ModelRow)
		}
	}

	const base = () => {
		let qb = supabase.from('device_models').select(DEVICE_MODEL_LIST_SELECT)
		qb = qb.eq('organization_id', organizationId)
		if (deviceTypeId) qb = qb.eq('device_type_id', deviceTypeId)
		return qb
	}

	const { data: d1, error: e1 } = await base()
		.ilike('model', `%${safe}%`)
		.order('model', { ascending: true })
		.limit(perBranch)
	if (!e1) merge(d1 as ModelRow[])

	if (tokens.length >= 2) {
		let qb2 = base()
		for (const tok of tokens) {
			qb2 = qb2.ilike('model', `%${escapeIlikePattern(tok)}%`)
		}
		const { data: d2, error: e2 } = await qb2.order('model', { ascending: true }).limit(perBranch)
		if (!e2) merge(d2 as ModelRow[])
	}

	if (compact && compact !== safe) {
		const { data: d3, error: e3 } = await base()
			.ilike('model', `%${compact}%`)
			.order('model', { ascending: true })
			.limit(perBranch)
		if (!e3) merge(d3 as ModelRow[])
	}

	let qb4 = supabase
		.from('device_models')
		.select(
			'id, model, device_type_id, device_types!inner ( id, name, device_brands!inner ( id, name ) )',
		)
	qb4 = qb4.eq('organization_id', organizationId)
	if (deviceTypeId) qb4 = qb4.eq('device_type_id', deviceTypeId)
	const { data: d4, error: e4 } = await qb4
		.or(`model.ilike.%${safe}%,device_types.device_brands.name.ilike.%${safe}%`)
		.order('model', { ascending: true })
		.limit(perBranch)

	if (!e4) merge(d4 as ModelRow[])

	let merged = [...byId.values()]
	const mapped = mapDeviceModelRows(merged)
	if (tokens.length >= 2) {
		const narrowed = new Set(
			mapped
				.filter((m) => {
					const lab = `${m.brand || ''} ${m.model || ''}`.toLowerCase()
					return tokens.every((t) => lab.includes(t.toLowerCase()))
				})
				.map((m) => m.id),
		)
		merged = merged.filter((row) => narrowed.has(String(row.id)))
	}

	merged.sort((a, b) =>
		String(a.model || '').localeCompare(String(b.model || ''), 'pt-BR', { sensitivity: 'base' }),
	)
	return merged.slice(0, limit)
}

export async function GET(request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}

	const url = new URL(request.url)
	const idsParam = cleanText(String(url.searchParams.get('ids') || ''))

	if (idsParam) {
		const unique = [
			...new Set(
				idsParam
					.split(',')
					.map((s) => s.trim().toLowerCase())
					.filter((s) => UUID_RE.test(s)),
			),
		].slice(0, 120)
		if (unique.length === 0) {
			return NextResponse.json({ ok: true, deviceModels: [] })
		}

		const { data, error } = await auth.supabase
			.from('device_models')
			.select('id, model, device_type_id, device_types ( id, name, device_brands ( id, name ) )')
			.eq('organization_id', auth.organizationId)
			.in('id', unique)

		if (error) {
			return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
		}

		const rows = mapDeviceModelRows(data as ModelRow[])
		const res = NextResponse.json({ ok: true, deviceModels: rows })
		res.headers.set('Cache-Control', 'private, max-age=300')
		return res
	}

	const deviceTypeId = cleanText(String(url.searchParams.get('device_type_id') || url.searchParams.get('deviceTypeId') || ''))
	const q = cleanText(String(url.searchParams.get('q') || ''))

	let limit = Number.parseInt(String(url.searchParams.get('limit') || '500'), 10)
	if (Number.isNaN(limit) || limit < 1) limit = 500
	limit = Math.min(limit, 8000)

	let rows: ReturnType<typeof mapDeviceModelRows>

	if (q) {
		const merged = await searchDeviceModelsByText(auth.supabase, auth.organizationId, q, deviceTypeId, limit)
		rows = mapDeviceModelRows(merged)
	} else {
		const query = auth.supabase
			.from('device_models')
			.select(DEVICE_MODEL_LIST_SELECT)
			.eq('organization_id', auth.organizationId)
			.order('model', { ascending: true })
			.limit(limit)

		if (deviceTypeId) query.eq('device_type_id', deviceTypeId)

		const { data, error } = await query
		if (error) {
			return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
		}

		rows = mapDeviceModelRows(data as ModelRow[])
	}

	const res = NextResponse.json({ ok: true, deviceModels: rows })
	res.headers.set('Cache-Control', 'private, max-age=300')
	return res
}

export async function POST(request: Request) {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
	}

	const body = await request.json().catch(() => null)
	const deviceTypeId = (body?.device_type_id ?? body?.deviceTypeId ?? '').trim()
	const model = cleanText(body?.model)

	if (!deviceTypeId || !model) {
		return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
	}

	const { data: typeRow } = await auth.supabase
		.from('device_types')
		.select('id, name, device_brands ( id, name )')
		.eq('id', deviceTypeId)
		.eq('organization_id', auth.organizationId)
		.maybeSingle()
	const tr = typeRow as { name?: string | null; device_brands?: { name?: string | null } | { name?: string | null }[] | null } | null
	const db = tr?.device_brands
	const brandName = (Array.isArray(db) ? db[0]?.name : db?.name) ?? ''
	const deviceTypeName = tr?.name ?? ''
	if (!brandName || !deviceTypeName) {
		return NextResponse.json({ ok: false, error: 'invalid_device_type' }, { status: 400 })
	}

	const { data: existing } = await auth.supabase
		.from('device_models')
		.select('id, model, device_type_id')
		.eq('organization_id', auth.organizationId)
		.eq('device_type_id', deviceTypeId)
		.eq('model', model)
		.maybeSingle()

	if (existing?.id) {
		return NextResponse.json({
			ok: true,
			deviceModel: { id: existing.id, model: existing.model, device_type_id: existing.device_type_id, brand: brandName, device_type: deviceTypeName },
			existed: true,
		})
	}

	const { data: inserted, error } = await auth.supabase
		.from('device_models')
		.insert({
			device_type_id: deviceTypeId,
			model,
			organization_id: auth.organizationId,
		})
		.select('id, model, device_type_id')
		.single()

	if (error) {
		const { data: after } = await auth.supabase
			.from('device_models')
			.select('id, model, device_type_id')
			.eq('organization_id', auth.organizationId)
			.eq('device_type_id', deviceTypeId)
			.eq('model', model)
			.maybeSingle()
		if (after?.id) {
			return NextResponse.json({
				ok: true,
				deviceModel: { id: after.id, model: after.model, device_type_id: after.device_type_id, brand: brandName, device_type: deviceTypeName },
				existed: true,
			})
		}
		return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
	}

	return NextResponse.json({
		ok: true,
		deviceModel: { id: inserted.id, model: inserted.model, device_type_id: inserted.device_type_id, brand: brandName, device_type: deviceTypeName },
		existed: false,
	})
}

