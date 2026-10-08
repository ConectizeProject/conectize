import type { SupabaseClient } from '@supabase/supabase-js'
import { iphoneModels } from '@/lib/data/hotsite-loja'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { isEmailFormat, isValidCpf, onlyDigits } from '@/lib/utils/strings'
import { notifyStaffOfAppointment } from './notify'
import {
	canCustomerChangeAppointment,
	formatAppointmentWhen,
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
	| 'nao_encontrado'
	| 'nao_editavel'
	| 'config'

export type CreateAppointmentInput = {
	model: string
	startsAt: string
	fullName: string
	email: string
	phone: string
	cpf: string
	honeypot?: string
}

function isEmail (value: string) {
	return isEmailFormat(value)
}

function normalizeModel (value: string) {
	const trimmed = value.trim()
	return (iphoneModels as readonly string[]).includes(trimmed) ? trimmed : ''
}

export async function listOpenAppointmentStarts (
	supabase: SupabaseClient,
	dateKey: string,
) {
	if (dateKey > lastBookableDateKey()) return []
	const starts = listSlotStarts(dateKey)
	if (!starts.length) return []
	const { data, error } = await supabase
		.from('service_orders')
		.select('appointment_starts_at')
		.eq('organization_id', HOST_ORG)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.in('appointment_starts_at', starts)
	if (error) {
		if (error.code === '42703') {
			console.error('[bateria-horarios] colunas de agendamento ainda não existem', error.message)
			const now = new Date()
			return starts.filter((iso) => new Date(iso).getTime() > now.getTime())
		}
		throw error
	}
	const taken = new Set((data ?? []).map((row) => new Date(String(row.appointment_starts_at)).toISOString()))
	const now = new Date()
	return starts.filter((iso) => !taken.has(iso) && new Date(iso).getTime() > now.getTime())
}

async function findDeviceModelId (supabase: SupabaseClient, model: string) {
	const { data } = await supabase
		.from('device_models')
		.select('id, model, device_types ( name, device_brands ( name ) )')
		.ilike('model', model)
		.limit(20)
	const rows = (data ?? []) as Array<{
		id: string
		model: string | null
		device_types?: { name?: string | null, device_brands?: { name?: string | null } | Array<{ name?: string | null }> | null } | Array<{ name?: string | null, device_brands?: { name?: string | null } | Array<{ name?: string | null }> | null }> | null
	}>
	const match = rows.find((row) => {
		const typeRow = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
		const brandRow = Array.isArray(typeRow?.device_brands) ? typeRow?.device_brands[0] : typeRow?.device_brands
		const brand = String(brandRow?.name || '').toLowerCase()
		const type = String(typeRow?.name || '').toLowerCase()
		return brand === 'apple' && (type === 'smartphone' || type === 'iphone' || type.includes('celular'))
			&& String(row.model || '').trim().toLowerCase() === model.toLowerCase()
	})
	return match?.id ?? rows.find((row) => String(row.model || '').trim().toLowerCase() === model.toLowerCase())?.id ?? null
}

async function countRecentAppointments (supabase: SupabaseClient, customerId: string) {
	const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
	const { count } = await supabase
		.from('service_orders')
		.select('id', { count: 'exact', head: true })
		.eq('organization_id', HOST_ORG)
		.eq('origin', 'agendamento')
		.eq('customer_id', customerId)
		.gte('created_at', since)
	return count ?? 0
}

export async function createBatteryAppointment (
	supabase: SupabaseClient,
	input: CreateAppointmentInput,
) {
	if (String(input.honeypot || '').trim()) {
		return { ok: false as const, error: 'dados_invalidos' as const }
	}
	const model = normalizeModel(input.model)
	const fullName = input.fullName.trim().slice(0, 120)
	const email = input.email.trim().toLowerCase().slice(0, 160)
	const phone = onlyDigits(input.phone).slice(0, 11)
	const cpf = onlyDigits(input.cpf).slice(0, 11)
	if (!model || fullName.length < 3 || !isEmail(email) || (phone.length !== 10 && phone.length !== 11) || !isValidCpf(cpf)) {
		return { ok: false as const, error: 'dados_invalidos' as const }
	}
	if (!isBookableSlot(input.startsAt)) {
		return { ok: false as const, error: 'horario_indisponivel' as const }
	}
	const startsAt = new Date(input.startsAt).toISOString()

	const { data: existing } = await supabase
		.from('customers')
		.select('id, full_name, email, mobile_phone')
		.eq('organization_id', HOST_ORG)
		.eq('cpf', cpf)
		.maybeSingle()

	let customerId = existing?.id ? String(existing.id) : ''
	let nameNote = ''
	if (customerId) {
		if (String(existing?.full_name || '').trim() && String(existing?.full_name || '').trim() !== fullName) {
			nameNote = `Nome informado no agendamento: ${fullName}. Cadastro existente mantido.`
		}
		const patch: Record<string, string> = {}
		if (!String(existing?.email || '').trim()) patch.email = email
		if (!String(existing?.mobile_phone || '').trim()) patch.mobile_phone = phone
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
				referral_source: 'site',
			})
			.select('id')
			.single()
		if (error || !created?.id) {
			return { ok: false as const, error: 'config' as const }
		}
		customerId = String(created.id)
	}

	if (await countRecentAppointments(supabase, customerId) >= 3) {
		return { ok: false as const, error: 'limite' as const }
	}

	const deviceModelId = await findDeviceModelId(supabase, model)
	const when = formatAppointmentWhen(startsAt)
	const description = [
		`Agendamento online de troca de bateria. Modelo: ${model}. Horário: ${when}. Desconto de 5% do agendamento online.`,
		nameNote,
	].filter(Boolean).join(' ')

	const { data: inserted, error } = await supabase
		.from('service_orders')
		.insert({
			organization_id: HOST_ORG,
			customer_id: customerId,
			title: `Troca de bateria ${model}`,
			status: 'orcamento',
			origin: 'agendamento',
			appointment_starts_at: startsAt,
			appointment_model_label: model,
			device_model_id: deviceModelId,
			estimated_ready_at: startsAt,
			customer_description: description,
			receiving_notes: 'Revisar agendamento online antes de lançar o preço da bateria. Desconto de 5% já aplicado.',
			services: [],
			services_total_cents: 0,
			services_cost_total_cents: 0,
			discount_mode: 'percent',
			discount_percent: 5,
			discount_cents: 0,
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
	const when = formatAppointmentWhen(next)
	const { error } = await supabase
		.from('service_orders')
		.update({
			appointment_starts_at: next,
			estimated_ready_at: next,
			customer_description: `Agendamento online de troca de bateria. Modelo: ${row.appointment_model_label || row.title}. Horário: ${when}. Desconto de 5% do agendamento online.`,
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

export async function listDayAppointments (supabase: SupabaseClient, organizationId: string, dateKey: string) {
	if (!isDateKey(dateKey)) return []
	const starts = listSlotStarts(dateKey)
	if (!starts.length) return []
	const { data } = await supabase
		.from('service_orders')
		.select('id, display_number, appointment_starts_at, appointment_model_label, appointment_reviewed_at, status, title, customer_id')
		.eq('organization_id', organizationId)
		.eq('origin', 'agendamento')
		.neq('status', 'cancelada')
		.in('appointment_starts_at', starts)
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
		const key = new Date(String(row.appointment_starts_at)).toISOString()
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
