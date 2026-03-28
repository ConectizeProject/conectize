'use server'

import { normalizePortalRole } from '@/lib/auth/portal-api'
import { applyOrderStatusChange } from '@/lib/orders/apply-order-status-change'
import {
	buildOrderEditDiff,
	enrichWarrantyTemplateHistoryValues,
} from '@/lib/orders/order-edit-history'
import {
	parsePaymentMethodsJson,
	parseServicesJson,
} from '@/lib/orders/order-form-parsers'
import {
	isFinalizedOrderStatus,
	isValidOrderStatus,
} from '@/lib/orders/order-status'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'
import {
	createSupabaseServerClient,
	getPortalAuth,
} from '@/lib/supabase/server'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { previsaoToISO } from '@/lib/utils/previsao-ordem'
import { redirect } from 'next/navigation'

export async function updateOrderAction (formData: FormData) {
	const formOrderId = String(formData.get('orderId') || '').trim()
	const title = String(formData.get('title') || '').trim()
	const status = String(formData.get('status') || '').trim()
	const imei = String(formData.get('imei') || '').trim()
	const color = String(formData.get('color') || '').trim()
	const isWarranty = Boolean(formData.get('isWarranty'))
	const estimatedReadyAtRaw = String(
		formData.get('estimatedReadyAt') || '',
	).trim()
	const passcodeType = String(formData.get('passcodeType') || '').trim()
	const passcodeText = String(formData.get('passcodeText') || '').trim()
	const passcodePattern = String(
		formData.get('passcodePattern') || '',
	).trim()
	const paymentMethodsJson = formData.get('paymentMethodsJson')
	const customerDescription = String(
		formData.get('customerDescription') || '',
	).trim()
	const receivingNotes = String(formData.get('receivingNotes') || '').trim()
	const deviceEntryChecksRaw = formData.get('deviceEntryChecksJson')
	const deviceEntryChecksJson =
		typeof deviceEntryChecksRaw === 'string'
			? deviceEntryChecksRaw.trim()
			: ''
	const deviceExitChecksRaw = formData.get('deviceExitChecksJson')
	const deviceExitChecksJson =
		typeof deviceExitChecksRaw === 'string'
			? deviceExitChecksRaw.trim()
			: ''
	const deviceModelId = parseOptionalUuid(formData.get('deviceModelId'))
	const brand = String(formData.get('brand') || '').trim() || null
	const model = String(formData.get('model') || '').trim() || null
	const warrantyTemplateId = parseOptionalUuid(
		formData.get('warrantyTemplateId'),
	)
	const warrantyTextRaw = String(formData.get('warrantyText') || '').trim()
	const formSellerUserId = String(
		formData.get('seller_user_id') || '',
	).trim()
	const servicesJson = formData.get('servicesJson')
	const services = parseServicesJson(servicesJson)

	let deviceEntryChecks: unknown = null
	if (deviceEntryChecksJson) {
		try {
			deviceEntryChecks = JSON.parse(deviceEntryChecksJson)
		} catch {
			deviceEntryChecks = null
		}
	}
	let deviceExitChecks: unknown = null
	if (deviceExitChecksJson) {
		try {
			deviceExitChecks = JSON.parse(deviceExitChecksJson)
		} catch {
			deviceExitChecks = null
		}
	}

	const estimatedReadyAt = previsaoToISO(estimatedReadyAtRaw)

	if (!formOrderId) {
		redirect('/portal/ordens?error=dados_invalidos')
	}
	if (!title) {
		redirect(`/portal/ordens/${formOrderId}?error=titulo_obrigatorio`)
	}
	if (!isValidOrderStatus(status)) {
		redirect(`/portal/ordens/${formOrderId}?error=status_invalido`)
	}

	const { user, role } = await getPortalAuth()
	if (!user) redirect('/portal/login')

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()
	const { data: existing, error: fetchExistingError } = await supabase
		.from('service_orders')
		.select(
			`status, services, title, imei, color, is_warranty, estimated_ready_at,
				passcode_type, passcode_text, passcode_pattern,
				payment_methods, customer_description, receiving_notes,
				warranty_template_id, warranty_text, device_model_id, brand, model,
				services_total_cents, services_cost_total_cents,
				device_entry_checks, device_exit_checks, seller_user_id, closed_at,
				created_at`,
		)
		.eq('id', formOrderId)
		.maybeSingle()

	if (fetchExistingError) {
		console.error('[order-save-fetch]', {
			orderId: formOrderId,
			code: fetchExistingError.code,
			message: fetchExistingError.message,
			details: fetchExistingError.details,
			hint: fetchExistingError.hint,
		})
		const saveQs = new URLSearchParams()
		saveQs.set('error', 'nao_foi_possivel_salvar')
		const ec = String(fetchExistingError.code || '')
			.trim()
			.slice(0, 48)
		const emRaw = [
			fetchExistingError.message,
			fetchExistingError.details,
			fetchExistingError.hint,
		]
			.filter(Boolean)
			.join(' — ')
		const em = String(emRaw || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 320)
		if (ec) saveQs.set('ec', ec)
		if (em) saveQs.set('em', em)
		redirect(`/portal/ordens/${formOrderId}?${saveQs.toString()}`)
	}

	if (!existing) {
		redirect(`/portal/ordens/${formOrderId}?error=ordem_nao_encontrada`)
	}

	const minPrevisaoMs = existing.created_at
		? new Date(String(existing.created_at)).getTime()
		: Date.now()
	if (
		estimatedReadyAt &&
		new Date(estimatedReadyAt).getTime() < minPrevisaoMs - 60_000
	) {
		redirect(`/portal/ordens/${formOrderId}?error=previsao_invalida`)
	}
	const isOrderFinalized =
		existing && isFinalizedOrderStatus(String(existing.status || ''))
	if (isOrderFinalized && role !== 'admin') {
		redirect(`/portal/ordens/${formOrderId}?error=ordem_finalizada`)
	}
	const updatePayload: Record<string, unknown> = {
		title,
		status,
		imei: imei || null,
		color: color || null,
		is_warranty: isWarranty,
		estimated_ready_at: estimatedReadyAt,
		passcode_type:
			passcodeType === 'text' || passcodeType === 'pattern'
				? passcodeType
				: null,
		passcode_text: passcodeType === 'text' ? passcodeText || null : null,
		passcode_pattern:
			passcodeType === 'pattern' ? passcodePattern || null : null,
		payment_methods: parsePaymentMethodsJson(paymentMethodsJson),
		customer_description: customerDescription || null,
		receiving_notes: receivingNotes || null,
		warranty_template_id: warrantyTemplateId,
		warranty_text: warrantyTextRaw || null,
		device_model_id: deviceModelId,
		brand: brand ?? null,
		model: model ?? null,
		services: services.items,
		services_total_cents: services.totalValueCents,
		services_cost_total_cents: services.totalCostCents,
	}
	if (formData.has('deviceEntryChecksJson')) {
		updatePayload.device_entry_checks = deviceEntryChecks
	}
	if (formData.has('deviceExitChecksJson')) {
		updatePayload.device_exit_checks = deviceExitChecks
	}
	if (role === 'admin' && formSellerUserId) {
		const { data: sellerUser } = await supabase
			.from('users')
			.select('id')
			.eq('id', formSellerUserId)
			.in('role', ['admin', 'staff'])
			.maybeSingle()
		if (sellerUser?.id) updatePayload.seller_user_id = sellerUser.id
	}
	if (isFinalizedOrderStatus(status)) {
		updatePayload.closed_at = new Date().toISOString()
	}
	const { error } = await supabase
		.from('service_orders')
		.update(updatePayload)
		.eq('id', formOrderId)

	if (error) {
		const saveQs = new URLSearchParams()
		saveQs.set('error', 'nao_foi_possivel_salvar')
		const ec = String(error.code || '')
			.trim()
			.slice(0, 48)
		const emRaw = [error.message, error.details, error.hint]
			.filter(Boolean)
			.join(' — ')
		const em = String(emRaw || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 320)
		if (ec) saveQs.set('ec', ec)
		if (em) saveQs.set('em', em)
		console.error('[order-save]', {
			orderId: formOrderId,
			code: error.code,
			message: error.message,
			details: error.details,
			hint: error.hint,
		})
		redirect(`/portal/ordens/${formOrderId}?${saveQs.toString()}`)
	}

	const diffRows = buildOrderEditDiff(
		existing as Record<string, unknown>,
		updatePayload,
	)
	const diffRowsForHistory = await enrichWarrantyTemplateHistoryValues(
		supabase,
		diffRows,
	)
	if (diffRowsForHistory.length > 0) {
		const editedAt = new Date().toISOString()
		const { error: histErr } = await supabase
			.from('service_order_edit_history')
			.insert(
				diffRowsForHistory.map((r) => ({
					service_order_id: formOrderId,
					edited_by: user.id,
					edited_at: editedAt,
					field_key: r.field_key,
					old_value: r.old_value,
					new_value: r.new_value,
				})),
			)
		if (histErr) {
			console.error('[order-edit-history]', histErr)
		}
	}

	try {
		const previousStatus = String(existing?.status || '').trim()
		const nextStatus = status
		const servicesForStock =
			nextStatus === 'cancelada'
				? (existing?.services ?? [])
				: services.items
		await applyOrderStatusStockTransition({
			supabase,
			orderId: formOrderId,
			previousStatus,
			nextStatus,
			services: servicesForStock,
			actorUserId: user.id,
		})
	} catch (err) {
		console.error('[order-save stock]', err)
	}

	redirect(`/portal/ordens/${formOrderId}?ok=1`)
}

export type UpdateOrderStatusActionResult =
	| { ok: true }
	| {
			ok: false
			error:
				| 'not_authenticated'
				| 'forbidden'
				| 'invalid_id'
				| 'invalid_status'
				| 'not_found'
				| 'db_error'
				| 'exit_considerations_incomplete'
	  }

/**
 * Alteração rápida de status (menu da OS, lista de ordens).
 * Mesma regra de negócio que `PATCH /api/portal/ordens/[id]` — ver `applyOrderStatusChange`.
 */
export async function updateOrderStatusAction (
	formData: FormData,
): Promise<UpdateOrderStatusActionResult> {
	const orderId = parseOptionalUuid(String(formData.get('orderId') || ''))
	const status = String(formData.get('status') || '').trim()

	if (!orderId) {
		return { ok: false, error: 'invalid_id' }
	}
	if (!isValidOrderStatus(status)) {
		return { ok: false, error: 'invalid_status' }
	}

	const { user, role } = await getPortalAuth()
	if (!user) {
		return { ok: false, error: 'not_authenticated' }
	}
	const normalized = normalizePortalRole(role)
	if (normalized !== 'staff' && normalized !== 'admin') {
		return { ok: false, error: 'forbidden' }
	}

	const supabase = await createSupabaseServerClient()
	const confirmRaw = String(formData.get('confirmIncompleteExit') || '').trim()
	const skipExitConsiderationsCheck =
		confirmRaw === '1' || confirmRaw.toLowerCase() === 'true'

	const applied = await applyOrderStatusChange(supabase, {
		orderId,
		nextStatus: status,
		editorUserId: user.id,
		skipExitConsiderationsCheck,
	})

	if (applied.ok) return { ok: true }
	if (applied.error === 'exit_considerations_incomplete') {
		return { ok: false, error: 'exit_considerations_incomplete' }
	}
	if (applied.error === 'not_found') {
		return { ok: false, error: 'not_found' }
	}
	if (applied.error === 'invalid_status') {
		return { ok: false, error: 'invalid_status' }
	}
	return { ok: false, error: 'db_error' }
}

export async function deleteOrderAction (formData: FormData) {
	const orderId = String(formData.get('orderId') || '').trim()
	if (!orderId) redirect('/portal/ordens?error=dados_invalidos')

	const { user, role } = await getPortalAuth()
	if (!user) redirect('/portal/login')

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
	if (normalizedRole !== 'admin') {
		redirect(`/portal/ordens/${orderId}?error=sem_permissao`)
	}

	const supabase = await createSupabaseServerClient()
	const { error } = await supabase
		.from('service_orders')
		.delete()
		.eq('id', orderId)

	if (error) {
		redirect(`/portal/ordens/${orderId}?error=nao_foi_possivel_excluir`)
	}

	redirect('/portal/ordens?ok=1')
}
