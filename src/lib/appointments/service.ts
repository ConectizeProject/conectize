import type { SupabaseClient } from '@supabase/supabase-js'
import { iphoneModels } from '@/lib/data/hotsite-loja'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { FINALIZED_ORDER_STATUSES } from '@/lib/orders/order-status'
import { isEmailFormat, isValidCpf, onlyDigits } from '@/lib/utils/strings'
import { bookingIpAllowed, recordBookingIp } from './booking-ip'
import { matchBatteryProduct } from './battery-prices'
import { notifyStaffOfAppointment } from './notify'
import {
	batteryOrderServices,
	BOOKING_CUSTOMER_DESCRIPTION,
	BOOKING_ORDER_TITLE,
	buildAppointmentInternalNote,
	normalizeAppointmentVisit,
	type AppointmentVisit,
	type BatteryOrderProduct,
} from './order-draft'
import {
	addDateKeyDays,
	appointmentInstantKey,
	canCustomerChangeAppointment,
	datesWithOpenSlots,
	formatAppointmentWhen,
	formatDateKeySaoPaulo,
	formatSlotLabel,
	isBookableSlot,
	isDateKey,
	lastBookableDateKey,
	listSlotStarts,
} from './slots'

const HOST_ORG = CONECTIZE_HOST_ORGANIZATION_ID

export type AppointmentPublicError =
	| 'dados_invalidos'
	| 'horario_indisponivel'
	| 'limite'
	| 'limite_ip'
	| 'ja_agendado'
	| 'ocupado'
	| 'nao_encontrado'
	| 'nao_editavel'
	| 'config'

export type ActiveAppointmentNotice = {
	displayNumber: number | null
	title: string
	model: string
	when: string
}

const SIMULTANEOUS_APPOINTMENT_LIMIT = 3

export function nextAppointmentDecision (activeCount: number, confirmExtra: boolean) {
	if (activeCount >= SIMULTANEOUS_APPOINTMENT_LIMIT) return 'limite' as const
	if (activeCount > 0 && !confirmExtra) return 'ja_agendado' as const
	return 'criar' as const
}

export type CreateAppointmentInput = {
	model: string
	startsAt: string
	fullName: string
	email: string
	phone: string
	cpf: string
	honeypot?: string
	confirmExtra?: boolean
	clientIp?: string
	visit?: Partial<AppointmentVisit> | null
}

function isEmail (value: string) {
	return isEmailFormat(value)
}

function normalizeModel (value: string) {
	const trimmed = value.trim()
	return (iphoneModels as readonly string[]).includes(trimmed) ? trimmed : ''
}

function dayWindow (fromKey: string, toKeyExclusive: string) {
	return {
		start: new Date(`${fromKey}T00:00:00-03:00`).toISOString(),
		end: new Date(`${toKeyExclusive}T00:00:00-03:00`).toISOString(),
	}
}

function isMissingTable (error: { code?: string, message?: string } | null) {
	if (!error) return false
	const code = String(error.code || '')
	return code === '42P01' || code === 'PGRST205'
}

function instantWindow (iso: string) {
	const start = appointmentInstantKey(iso)
	if (!start) return null
	return {
		start,
		end: new Date(new Date(start).getTime() + 1000).toISOString(),
	}
}

async function blockedInstantKeys (
	supabase: SupabaseClient,
	organizationId: string,
	fromIso: string,
	toIso: string,
) {
	const { data, error } = await supabase
		.from('appointment_slot_blocks')
		.select('starts_at')
		.eq('organization_id', organizationId)
		.gte('starts_at', fromIso)
		.lt('starts_at', toIso)
	if (error) {
		if (!isMissingTable(error)) console.error('[agendamento-bloqueio]', error.message)
		return [] as string[]
	}
	return (data ?? []).map((row) => appointmentInstantKey(String(row.starts_at))).filter(Boolean)
}

async function occupiedInstantKeys (
	supabase: SupabaseClient,
	organizationId: string,
	fromIso: string,
	toIso: string,
) {
	const { data, error } = await supabase
		.from('service_orders')
		.select('appointment_starts_at')
		.eq('organization_id', organizationId)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.gte('appointment_starts_at', fromIso)
		.lt('appointment_starts_at', toIso)
	if (error) return { error, keys: new Set<string>() }
	const keys = new Set((data ?? []).map((row) => appointmentInstantKey(String(row.appointment_starts_at))).filter(Boolean))
	const blocked = await blockedInstantKeys(supabase, organizationId, fromIso, toIso)
	for (const key of blocked) keys.add(key)
	return { error: null, keys }
}

async function isInstantBlocked (supabase: SupabaseClient, organizationId: string, iso: string) {
	const window = instantWindow(iso)
	if (!window) return false
	const blocked = await blockedInstantKeys(supabase, organizationId, window.start, window.end)
	return blocked.includes(window.start)
}

export async function listBlockedStarts (
	supabase: SupabaseClient,
	organizationId: string,
	fromKey: string,
	toKey: string,
) {
	if (!isDateKey(fromKey) || !isDateKey(toKey) || fromKey > toKey) return []
	const range = dayWindow(fromKey, addDateKeyDays(toKey, 1))
	return blockedInstantKeys(supabase, organizationId, range.start, range.end)
}

export async function toggleAppointmentSlotBlock (
	supabase: SupabaseClient,
	organizationId: string,
	userId: string,
	startsAt: string,
) {
	const window = instantWindow(startsAt)
	if (!window) return { ok: false as const, error: 'horario_indisponivel' as const }
	const { data: existing, error: readError } = await supabase
		.from('appointment_slot_blocks')
		.select('id')
		.eq('organization_id', organizationId)
		.gte('starts_at', window.start)
		.lt('starts_at', window.end)
		.limit(1)
	if (readError) {
		console.error('[agendamento-bloqueio]', readError.message)
		return { ok: false as const, error: 'config' as const }
	}
	if (existing?.[0]?.id) {
		const { error } = await supabase.from('appointment_slot_blocks').delete().eq('id', existing[0].id)
		if (error) return { ok: false as const, error: 'config' as const }
		return { ok: true as const, blocked: false as const, startsAt: window.start }
	}
	if (!isBookableSlot(window.start)) return { ok: false as const, error: 'horario_indisponivel' as const }
	const { data: orders, error: orderError } = await supabase
		.from('service_orders')
		.select('id')
		.eq('organization_id', organizationId)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.gte('appointment_starts_at', window.start)
		.lt('appointment_starts_at', window.end)
		.limit(1)
	if (orderError) return { ok: false as const, error: 'config' as const }
	if (orders?.[0]?.id) return { ok: false as const, error: 'ocupado' as const }
	const { error } = await supabase.from('appointment_slot_blocks').insert({
		organization_id: organizationId,
		starts_at: window.start,
		created_by: userId,
	})
	if (error) {
		if (String(error.code || '') === '23505') {
			return { ok: true as const, blocked: true as const, startsAt: window.start }
		}
		console.error('[agendamento-bloqueio]', error.message)
		return { ok: false as const, error: 'config' as const }
	}
	return { ok: true as const, blocked: true as const, startsAt: window.start }
}

export async function listOpenAppointmentStarts (
	supabase: SupabaseClient,
	dateKey: string,
) {
	if (dateKey > lastBookableDateKey()) return []
	const starts = listSlotStarts(dateKey)
	if (!starts.length) return []
	const range = dayWindow(dateKey, addDateKeyDays(dateKey, 1))
	const occupied = await occupiedInstantKeys(supabase, HOST_ORG, range.start, range.end)
	if (occupied.error) {
		if (occupied.error.code === '42703') {
			console.error('[bateria-horarios] colunas de agendamento ainda não existem', occupied.error.message)
			const now = new Date()
			return starts.filter((iso) => new Date(iso).getTime() > now.getTime())
		}
		throw occupied.error
	}
	const now = new Date()
	return starts.filter((iso) => !occupied.keys.has(iso) && new Date(iso).getTime() > now.getTime())
}

export async function listDatesWithOpenSlots (supabase: SupabaseClient) {
	const now = new Date()
	const today = formatDateKeySaoPaulo(now)
	const until = addDateKeyDays(lastBookableDateKey(now), 1)
	const range = dayWindow(today, until)
	const occupied = await occupiedInstantKeys(supabase, HOST_ORG, range.start, range.end)
	if (occupied.error) {
		if (occupied.error.code === '42703') return datesWithOpenSlots(new Set(), now)
		throw occupied.error
	}
	return datesWithOpenSlots(occupied.keys, now)
}

type DeviceModelRow = {
	id: string
	model: string | null
	device_types?: { name?: string | null, device_brands?: { name?: string | null } | Array<{ name?: string | null }> | null } | Array<{ name?: string | null, device_brands?: { name?: string | null } | Array<{ name?: string | null }> | null }> | null
}

function deviceModelLabels (model: string) {
	const suffix = model.replace(/^iphone\s+/i, '').trim()
	return [...new Set([model, suffix, suffix ? `iPhone ${suffix}` : ''].filter(Boolean))]
}

function isApplePhone (row: DeviceModelRow) {
	const typeRow = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
	const brandRow = Array.isArray(typeRow?.device_brands) ? typeRow?.device_brands[0] : typeRow?.device_brands
	const brand = String(brandRow?.name || '').toLowerCase()
	const type = String(typeRow?.name || '').toLowerCase()
	return brand === 'apple' && (type === 'smartphone' || type === 'iphone' || type.includes('celular'))
}

function pickDeviceModelId (rows: DeviceModelRow[], model: string) {
	const labels = new Set(deviceModelLabels(model).map((label) => label.toLowerCase()))
	const matches = rows.filter((row) => labels.has(String(row.model || '').trim().toLowerCase()))
	return matches.find((row) => isApplePhone(row))?.id ?? matches[0]?.id ?? null
}

async function findDeviceModelId (supabase: SupabaseClient, model: string, productId: string | null) {
	if (productId) {
		const { data } = await supabase
			.from('product_compatible_device_models')
			.select('device_models ( id, model, device_types ( name, device_brands ( name ) ) )')
			.eq('product_id', productId)
		const linked = ((data ?? []) as Array<{ device_models?: DeviceModelRow | DeviceModelRow[] | null }>)
			.flatMap((row) => {
				if (!row.device_models) return []
				return Array.isArray(row.device_models) ? row.device_models : [row.device_models]
			})
		const fromProduct = pickDeviceModelId(linked, model)
		if (fromProduct) return fromProduct
	}
	const labels = deviceModelLabels(model)
	const filter = labels.map((label) => `model.ilike."${label.replace(/"/g, '')}"`).join(',')
	const { data } = await supabase
		.from('device_models')
		.select('id, model, device_types ( name, device_brands ( name ) )')
		.eq('organization_id', HOST_ORG)
		.or(filter)
		.limit(20)
	return pickDeviceModelId((data ?? []) as DeviceModelRow[], model)
}

async function findBatteryProduct (supabase: SupabaseClient, model: string): Promise<BatteryOrderProduct | null> {
	const { data, error } = await supabase
		.from('products')
		.select('id, name, kind, sale_price_cents, cost_price_cents')
		.eq('organization_id', HOST_ORG)
		.eq('is_active', true)
		.ilike('name', '%Bateria iPhone Modelo:%')
	if (error) {
		console.error('[bateria-produto]', error.message)
		return null
	}
	const products = (data ?? []).map((row) => ({
		id: String(row.id || ''),
		name: String(row.name || ''),
		kind: row.kind === 'service' ? 'service' as const : 'product' as const,
		salePriceCents: Number(row.sale_price_cents) || 0,
		costPriceCents: Number(row.cost_price_cents) || 0,
	}))
	const match = matchBatteryProduct(model, products)
	return match?.id ? match : null
}

async function listActiveAppointments (supabase: SupabaseClient, customerId: string) {
	const closed = FINALIZED_ORDER_STATUSES.join(',')
	const { data, error } = await supabase
		.from('service_orders')
		.select('display_number, title, appointment_model_label, appointment_starts_at')
		.eq('organization_id', HOST_ORG)
		.eq('origin', 'agendamento')
		.eq('customer_id', customerId)
		.not('status', 'in', `(${closed})`)
		.order('appointment_starts_at', { ascending: true })
	if (error) {
		console.error('[appointment-create] agendamentos abertos', error.message)
		return null
	}
	return (data ?? []).map((row) => ({
		displayNumber: row.display_number ?? null,
		title: String(row.title || BOOKING_ORDER_TITLE),
		model: String(row.appointment_model_label || ''),
		when: formatAppointmentWhen(String(row.appointment_starts_at || '')),
	}))
}

export async function createBatteryAppointment (
	supabase: SupabaseClient,
	input: CreateAppointmentInput,
) {
	const honeypotFilled = Boolean(String(input.honeypot || '').trim())
	const model = normalizeModel(input.model)
	const fullName = input.fullName.trim().slice(0, 120)
	const email = input.email.trim().toLowerCase().slice(0, 160)
	const phone = onlyDigits(input.phone).slice(0, 11)
	const cpf = onlyDigits(input.cpf).slice(0, 11)
	const invalid = honeypotFilled
		? 'honeypot'
		: !model
			? 'modelo'
			: fullName.length < 3
				? 'nome'
				: !isEmail(email)
					? 'email'
					: phone.length !== 10 && phone.length !== 11
						? 'celular'
						: !isValidCpf(cpf)
							? 'cpf'
							: ''
	if (invalid) {
		console.error('[bateria-agendamento] dados_invalidos', invalid)
		return { ok: false as const, error: 'dados_invalidos' as const }
	}
	if (!isBookableSlot(input.startsAt)) {
		return { ok: false as const, error: 'horario_indisponivel' as const }
	}
	const startsAt = new Date(input.startsAt).toISOString()
	if (await isInstantBlocked(supabase, HOST_ORG, startsAt)) {
		return { ok: false as const, error: 'horario_indisponivel' as const }
	}

	const { data: existing } = await supabase
		.from('customers')
		.select('id, full_name, email, mobile_phone, referral_source')
		.eq('organization_id', HOST_ORG)
		.eq('cpf', cpf)
		.maybeSingle()

	let customerId = existing?.id ? String(existing.id) : ''
	let nameNote = ''
	if (customerId) {
		if (String(existing?.full_name || '').trim() && String(existing?.full_name || '').trim() !== fullName) {
			nameNote = `Nome informado no agendamento: ${fullName}. Cadastro existente mantido.`
		}
		const patch: Record<string, string> = {
			email,
			mobile_phone: phone,
			phone,
		}
		if (!String(existing?.referral_source || '').trim()) patch.referral_source = 'google'
		if (Object.keys(patch).length) {
			await supabase.from('customers').update(patch).eq('id', customerId)
		}
	} else {
		const { data: created, error } = await supabase
			.from('customers')
			.insert({
				organization_id: HOST_ORG,
				cpf,
				is_company: false,
				full_name: fullName,
				email,
				phone,
				mobile_phone: phone,
				referral_source: 'google',
			})
			.select('id')
			.single()
		if (error || !created?.id) {
			return { ok: false as const, error: 'config' as const }
		}
		customerId = String(created.id)
	}

	const active = await listActiveAppointments(supabase, customerId)
	if (!active) return { ok: false as const, error: 'config' as const }
	const decision = nextAppointmentDecision(active.length, Boolean(input.confirmExtra))
	if (decision === 'limite') {
		return { ok: false as const, error: 'limite' as const, appointments: active }
	}
	if (decision === 'ja_agendado') {
		return { ok: false as const, error: 'ja_agendado' as const, appointments: active }
	}

	const ipGate = await bookingIpAllowed(supabase, String(input.clientIp || ''))
	if (!ipGate.allowed) {
		return { ok: false as const, error: 'limite_ip' as const }
	}

	const battery = await findBatteryProduct(supabase, model)
	const deviceModelId = await findDeviceModelId(supabase, model, battery?.id ?? null)
	const when = formatAppointmentWhen(startsAt)
	const services = batteryOrderServices(battery)
	const visit = normalizeAppointmentVisit(input.visit)

	const { data: inserted, error } = await supabase
		.from('service_orders')
		.insert({
			organization_id: HOST_ORG,
			customer_id: customerId,
			title: BOOKING_ORDER_TITLE,
			status: 'orcamento',
			origin: 'agendamento',
			appointment_starts_at: startsAt,
			appointment_model_label: model,
			device_model_id: deviceModelId,
			estimated_ready_at: null,
			customer_description: BOOKING_CUSTOMER_DESCRIPTION,
			receiving_notes: null,
			services: services.items,
			services_total_cents: services.totalValueCents,
			services_cost_total_cents: services.totalCostCents,
			discount_mode: 'percent',
			discount_percent: 5,
			discount_cents: services.discountCents,
		})
		.select('id, display_number, share_token')
		.single()

	if (error || !inserted?.id) {
		if (String(error?.code || '') === '23505') {
			return { ok: false as const, error: 'horario_indisponivel' as const }
		}
		console.error('[appointment-create]', error)
		return { ok: false as const, error: 'config' as const }
	}

	const { error: noteError } = await supabase.from('service_order_internal_comments').insert({
		service_order_id: String(inserted.id),
		organization_id: HOST_ORG,
		author_user_id: null,
		author_display_name: 'Agendamento online',
		content: buildAppointmentInternalNote(visit, nameNote),
	})
	if (noteError) console.error('[appointment-create] descrição interna', noteError.message)

	if (ipGate.record) await recordBookingIp(supabase, ipGate.ipHash)

	await notifyStaffOfAppointment(supabase, {
		orderId: String(inserted.id),
		displayNumber: inserted.display_number ?? null,
		customerName: fullName,
		model,
		when,
	})

	return {
		ok: true as const,
		orderId: String(inserted.id),
		displayNumber: inserted.display_number ?? null,
		shareToken: inserted.share_token ? String(inserted.share_token) : '',
	}
}

type OwnedAppointment = {
	id: string
	display_number: number | null
	status: string
	share_token: string | null
	appointment_starts_at: string
	appointment_reviewed_at: string | null
	appointment_model_label: string | null
	title: string
}

async function loadOwnedAppointment (supabase: SupabaseClient, userId: string) {
	const { data: customer } = await supabase
		.from('customers')
		.select('id')
		.eq('organization_id', HOST_ORG)
		.eq('auth_user_id', userId)
		.maybeSingle()
	if (!customer?.id) return null
	const { data } = await supabase
		.from('service_orders')
		.select('id, display_number, status, share_token, appointment_starts_at, appointment_reviewed_at, appointment_model_label, title')
		.eq('organization_id', HOST_ORG)
		.eq('customer_id', customer.id)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.order('appointment_starts_at', { ascending: true })
		.limit(5)
	const rows = ((data ?? []) as OwnedAppointment[]).filter((row) => row.appointment_starts_at)
	const editable = rows.find((row) => canCustomerChangeAppointment(row.appointment_starts_at, row.appointment_reviewed_at, row.status))
	if (editable) return editable
	const upcoming = rows.find((row) => new Date(row.appointment_starts_at).getTime() > Date.now())
	return upcoming ?? rows[0] ?? null
}

export async function loadPublicBatteryAppointment (supabase: SupabaseClient, userId: string | null) {
	if (!userId) return null
	const row = await loadOwnedAppointment(supabase, userId)
	if (!row) return null
	return {
		id: row.id,
		displayNumber: row.display_number,
		model: row.appointment_model_label || row.title,
		startsAt: row.appointment_starts_at,
		when: formatAppointmentWhen(row.appointment_starts_at),
		shareToken: row.share_token || '',
		canChange: canCustomerChangeAppointment(row.appointment_starts_at, row.appointment_reviewed_at, row.status),
	}
}

export async function rescheduleBatteryAppointment (
	supabase: SupabaseClient,
	userId: string,
	startsAt: string,
) {
	const row = await loadOwnedAppointment(supabase, userId)
	if (!row) return { ok: false as const, error: 'nao_encontrado' as const }
	if (!canCustomerChangeAppointment(row.appointment_starts_at, row.appointment_reviewed_at, row.status)) {
		return { ok: false as const, error: 'nao_editavel' as const }
	}
	if (!isBookableSlot(startsAt)) {
		return { ok: false as const, error: 'horario_indisponivel' as const }
	}
	const next = new Date(startsAt).toISOString()
	if (await isInstantBlocked(supabase, HOST_ORG, next)) {
		return { ok: false as const, error: 'horario_indisponivel' as const }
	}
	const when = formatAppointmentWhen(next)
	const { error } = await supabase
		.from('service_orders')
		.update({
			appointment_starts_at: next,
			customer_description: BOOKING_CUSTOMER_DESCRIPTION,
		})
		.eq('id', row.id)
		.eq('origin', 'agendamento')
	if (error) {
		if (String(error.code || '') === '23505') {
			return { ok: false as const, error: 'horario_indisponivel' as const }
		}
		return { ok: false as const, error: 'config' as const }
	}
	return { ok: true as const, when }
}

export async function cancelBatteryAppointment (supabase: SupabaseClient, userId: string) {
	const row = await loadOwnedAppointment(supabase, userId)
	if (!row) return { ok: false as const, error: 'nao_encontrado' as const }
	if (!canCustomerChangeAppointment(row.appointment_starts_at, row.appointment_reviewed_at, row.status)) {
		return { ok: false as const, error: 'nao_editavel' as const }
	}
	const { error } = await supabase
		.from('service_orders')
		.update({ status: 'cancelada', closed_at: new Date().toISOString() })
		.eq('id', row.id)
		.eq('origin', 'agendamento')
	if (error) return { ok: false as const, error: 'config' as const }
	return { ok: true as const }
}

export async function listAppointmentsBetween (
	supabase: SupabaseClient,
	organizationId: string,
	fromKey: string,
	toKey: string,
) {
	if (!isDateKey(fromKey) || !isDateKey(toKey) || fromKey > toKey) return []
	const start = new Date(`${fromKey}T00:00:00-03:00`).toISOString()
	const end = new Date(`${addDateKeyDays(toKey, 1)}T00:00:00-03:00`).toISOString()
	const { data, error } = await supabase
		.from('service_orders')
		.select('id, display_number, appointment_starts_at, appointment_model_label, appointment_reviewed_at, status, title, customer_id')
		.eq('organization_id', organizationId)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.gte('appointment_starts_at', start)
		.lt('appointment_starts_at', end)
		.order('appointment_starts_at', { ascending: true })
	if (error) {
		console.error('[agendamentos]', error)
		return []
	}
	const rows = data ?? []
	const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))]
	const names = new Map<string, string>()
	if (customerIds.length) {
		const { data: customers } = await supabase
			.from('customers')
			.select('id, full_name')
			.in('id', customerIds)
		for (const customer of customers ?? []) {
			names.set(String(customer.id), String(customer.full_name || 'Cliente'))
		}
	}
	return rows.map((row) => ({
		id: String(row.id),
		displayNumber: row.display_number ?? null,
		model: String(row.appointment_model_label || row.title || ''),
		customerName: names.get(String(row.customer_id)) || 'Cliente',
		reviewed: Boolean(row.appointment_reviewed_at),
		startsAt: new Date(String(row.appointment_starts_at)).toISOString(),
	}))
}

export async function listDayAppointments (supabase: SupabaseClient, organizationId: string, dateKey: string) {
	if (!isDateKey(dateKey)) return []
	const starts = listSlotStarts(dateKey)
	if (!starts.length) return []
	const range = dayWindow(dateKey, addDateKeyDays(dateKey, 1))
	const { data } = await supabase
		.from('service_orders')
		.select('id, display_number, appointment_starts_at, appointment_model_label, appointment_reviewed_at, status, title, customer_id')
		.eq('organization_id', organizationId)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.gte('appointment_starts_at', range.start)
		.lt('appointment_starts_at', range.end)
	const rows = data ?? []
	const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))]
	const names = new Map<string, string>()
	if (customerIds.length) {
		const { data: customers } = await supabase
			.from('customers')
			.select('id, full_name')
			.in('id', customerIds)
		for (const customer of customers ?? []) {
			names.set(String(customer.id), String(customer.full_name || 'Cliente'))
		}
	}
	const byStart = new Map<string, typeof rows>()
	for (const row of rows) {
		const key = appointmentInstantKey(String(row.appointment_starts_at))
		const list = byStart.get(key) ?? []
		list.push(row)
		byStart.set(key, list)
	}
	return starts.map((iso) => ({
		startsAt: iso,
		label: formatSlotLabel(iso),
		orders: (byStart.get(iso) ?? []).map((row) => ({
			id: String(row.id),
			displayNumber: row.display_number ?? null,
			model: String(row.appointment_model_label || row.title || ''),
			customerName: names.get(String(row.customer_id)) || 'Cliente',
			reviewed: Boolean(row.appointment_reviewed_at),
		})),
	}))
}
