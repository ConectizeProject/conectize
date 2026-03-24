import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge, OsAssistAiIconButton } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateBr, formatDateTimeBr } from '@/lib/utils/format-date'
import { OrderDeviceSelector, OrderPaymentMethodsCard, OrderServicesCard, OrderServicesTotalProvider, OrderWarrantySelector } from '@/components/orders'
import { OrderCustomerCard } from './OrderCustomerCard'
import { OrderPasscodeFields } from './OrderPasscodeFields'
import { OrderDeviceEntryChecksEditor } from './OrderDeviceEntryChecksEditor'
import { OrderEntryPhotos } from './OrderEntryPhotos'
import { OrderAssistanceChat } from './OrderAssistanceChat'
import { OrderInternalCommentsChat } from './OrderInternalCommentsChat'
import { OrdemDetalheToastClient } from './OrdemDetalheToastClient'
import { OrdemLabelPrintButton } from './OrdemLabelPrintButton'
import { OrdemPrintButton } from './OrdemPrintButton'
import { OrdemActionsMenu } from './OrdemActionsMenu'
import { PrevisaoInput } from '@/components/previsao-input'
import { getMinPrevisaoForEdit, previsaoToISO, toDateTimeLocalInBrazil } from '@/lib/utils/previsao-ordem'
import { UpdateOrderSubmitButton } from './UpdateOrderSubmitButton'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { applyOrderStatusStockTransition } from '@/lib/orders/stock-by-status'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildOrderEditDiff } from '@/lib/orders/order-edit-history'
import { OrderEditHistoryDialog } from './OrderEditHistoryDialog'

export const dynamic = 'force-dynamic'

function formatStatus(status: string) {
	if (status === 'orcamento') return 'Orçamento'
	if (status === 'aguardando_aprovacao') return 'Aguardando aprovação'
	if (status === 'aprovado') return 'Aprovado'
	if (status === 'aguardando_pecas') return 'Aguardando peças'
	if (status === 'em_manutencao') return 'Em manutenção'
	if (status === 'aguardando_retirada') return 'Aguardando retirada'
	if (status === 'finalizada') return 'Finalizada'
	if (status === 'finalizada_sem_conserto') return 'Finalizada sem conserto'
	if (status === 'finalizada_sem_aprovacao') return 'Finalizada sem aprovação'
	if (status === 'cancelada') return 'Cancelada'
	return status
}

function isValidStatus(value: string) {
	return value === 'orcamento' ||
		value === 'aguardando_aprovacao' ||
		value === 'aprovado' ||
		value === 'aguardando_pecas' ||
		value === 'em_manutencao' ||
		value === 'aguardando_retirada' ||
		value === 'finalizada' ||
		value === 'finalizada_sem_conserto' ||
		value === 'finalizada_sem_aprovacao' ||
		value === 'cancelada'
}

const FINALIZED_STATUSES = new Set([
	'finalizada',
	'finalizada_sem_conserto',
	'finalizada_sem_aprovacao',
	'cancelada',
])

function getCustomerFromOrder(order: any) {
	const customer = order?.customers
	if (Array.isArray(customer)) return customer[0] || null
	return customer || null
}

function getDeviceModelFromOrder(order: any) {
	const deviceModel = order?.device_models
	if (Array.isArray(deviceModel)) return deviceModel[0] || null
	return deviceModel || null
}

function parseOrderPaymentMethods(order: any): Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }> {
	let pm = order?.payment_methods
	if (typeof pm === 'string') {
		try {
			pm = JSON.parse(pm)
		} catch {
			pm = null
		}
	}
	if (Array.isArray(pm) && pm.length > 0) {
		return pm
			.map((e: any) => {
				const id = parseOptionalUuid(e?.payment_method_id)
				if (!id) return null
				return {
					payment_method_id: id,
					installments: e.installments != null ? Number(e.installments) : undefined,
					value_cents: e.value_cents != null ? Math.max(0, Number(e.value_cents) || 0) : null,
				}
			})
			.filter(Boolean) as Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
	}
	const legacyId = parseOptionalUuid(order?.payment_method_id)
	if (legacyId) {
		return [{ payment_method_id: legacyId, installments: order?.installments ?? 1, value_cents: null }]
	}
	return []
}

function parsePaymentMethodsJson(raw: unknown): Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }> {
	if (!raw) return []
	try {
		const parsed = JSON.parse(String(raw))
		if (!Array.isArray(parsed)) return []
		return parsed
			.filter((item: unknown) => item && typeof item === 'object' && (item as any).payment_method_id)
			.map((item: any) => {
				const id = parseOptionalUuid(item.payment_method_id)
				if (!id) return null
				return {
					payment_method_id: id,
					installments: item.installments != null ? Math.max(1, Math.min(24, Number(item.installments) || 1)) : undefined,
					value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
				}
			})
			.filter(Boolean) as Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
	} catch {
		return []
	}
}

function parseServicesJson(raw: unknown): {
	items: Array<{
		kind?: 'service' | 'product'
		description: string
		quantity?: number
		unitValueCents?: number
		unitCostCents?: number
		valueCents: number
		costCents: number
	}>
	totalValueCents: number
	totalCostCents: number
} {
	if (!raw) return { items: [], totalValueCents: 0, totalCostCents: 0 }
	try {
		const parsed = JSON.parse(String(raw)) as { items?: unknown[]; totals?: { totalValueCents?: number; totalCostCents?: number } }
		const items = Array.isArray(parsed?.items) ? parsed.items : []
		const normalized = items
			.slice(0, 100)
			.map((item: unknown) => {
				const i = item as Record<string, unknown>
				const kind: 'service' | 'product' = i.kind === 'product' ? 'product' : 'service'
				const description = String(i?.description ?? '').trim().slice(0, 240)
				const quantityRaw =
					kind === 'product'
						? Number.parseInt(String(i?.quantity ?? '1'), 10)
						: 1
				const quantity =
					Number.isFinite(quantityRaw) && quantityRaw > 0
						? Math.min(9999, Math.max(1, quantityRaw))
						: 1
				const unitValueCentsRaw = i.unitValueCents ?? i.valueCents ?? 0
				const unitCostCentsRaw = i.unitCostCents ?? i.costCents ?? 0
				const unitValueCents = Math.max(
					0,
					Number(unitValueCentsRaw ?? 0) || 0,
				)
				const unitCostCents = Math.max(
					0,
					Number(unitCostCentsRaw ?? 0) || 0,
				)
				const valueCents = unitValueCents * quantity
				const costCents = unitCostCents * quantity
				const sourceProductId = parseOptionalUuid(i.sourceProductId)
				return {
					kind,
					description,
					quantity,
					unitValueCents,
					unitCostCents,
					valueCents,
					costCents,
					sourceProductId,
				}
			})
			.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)
		const totalValueCents = normalized.reduce((acc, s) => acc + s.valueCents, 0)
		const totalCostCents = normalized.reduce((acc, s) => acc + s.costCents, 0)
		return { items: normalized, totalValueCents, totalCostCents }
	} catch {
		return { items: [], totalValueCents: 0, totalCostCents: 0 }
	}
}

function formatDateTimeLocal(value: string | null | undefined) {
	if (!value) return ''
	const dt = new Date(String(value))
	if (Number.isNaN(dt.getTime())) return ''
	return toDateTimeLocalInBrazil(dt)
}

type PageProps = {
	params: Promise<{ id: string }>
	searchParams: Promise<{ ok?: string; error?: string; servicesModal?: string }>
}

export default async function OrdemDetalhePage({ params, searchParams }: PageProps) {
	const { id } = await params
	const { servicesModal } = await searchParams

	const { user, role } = await getPortalAuth()
	if (!user) redirect('/portal/login')

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()
	const [{ data: order }, { data: companySettings }, deviceModels, { data: warrantyTemplates }] = await Promise.all([
		supabase
			.from('service_orders')
			.select('id, display_number, status, title, imei, color, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, payment_methods, customer_description, receiving_notes, warranty_template_id, warranty_text, device_model_id, brand, model, services, services_total_cents, services_cost_total_cents, created_at, updated_at, closed_at, share_token, seller_user_id, device_entry_checks, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date, zip_code, state, city, neighborhood, street, street_number, street_complement, referral_source, referral_source_other ), device_models ( id, model, device_types ( name, device_brands ( name ) ) )')
			.eq('id', id)
			.maybeSingle(),
		supabase.from('company_settings').select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url').eq('id', 1).maybeSingle(),
		fetchDeviceModelsForSelector(supabase),
		supabase
			.from('warranty_templates')
			.select('id, name, body, is_active, is_default')
			.order('is_default', { ascending: false })
			.order('sort_order', { ascending: true })
			.order('created_at', { ascending: true }),
	])

	if (!order) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ordem não encontrada</CardTitle>
					<CardDescription>Verifique o ID e tente novamente.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link href="/portal/ordens">Voltar</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	const sellerUserId = (order as { seller_user_id?: string | null }).seller_user_id ?? null
	const isAdmin = role === 'admin'

	const [sellerUser, staffAdminUsers, entryPhotoCountRes] = await Promise.all([
		sellerUserId
			? supabase.from('users').select('id, full_name, email').eq('id', sellerUserId).maybeSingle()
			: Promise.resolve({ data: null }),
		isAdmin
			? supabase.from('users').select('id, full_name, email').in('role', ['admin', 'staff']).order('email')
			: Promise.resolve({ data: [] }),
		supabase
			.from('service_order_entry_photos')
			.select('*', { count: 'exact', head: true })
			.eq('service_order_id', order.id),
	])
	const entryPhotoCount = entryPhotoCountRes?.count ?? 0

	const seller = sellerUser.data
	const sellerDisplayName = seller ? (String(seller.full_name || '').trim() || String(seller.email || '').trim() || '(Sem nome)') : ''
	const sellerOptions = (staffAdminUsers.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>

	const customer = getCustomerFromOrder(order)
	const deviceModel = getDeviceModelFromOrder(order)
	const dt = (deviceModel as any)?.device_types || null
	const brandRow = dt?.device_brands || null
	const brandName = (brandRow?.name as string | undefined) ?? (order.brand as string | null) ?? ''
	const deviceTypeName = (dt?.name as string | undefined) ?? ''
	const deviceString = deviceModel
		? [brandName, deviceTypeName, (deviceModel as any)?.model as string | undefined].filter(Boolean).join(' • ') || ''
		: (order.brand || order.model ? [order.brand, order.model].filter(Boolean).join(' • ') : '')

	async function updateOrderAction(formData: FormData) {
		'use server'

		const formOrderId = String(formData.get('orderId') || '').trim()
		const title = String(formData.get('title') || '').trim()
		const status = String(formData.get('status') || '').trim()
		const imei = String(formData.get('imei') || '').trim()
		const color = String(formData.get('color') || '').trim()
		const isWarranty = Boolean(formData.get('isWarranty'))
		const estimatedReadyAtRaw = String(formData.get('estimatedReadyAt') || '').trim()
		const passcodeType = String(formData.get('passcodeType') || '').trim()
		const passcodeText = String(formData.get('passcodeText') || '').trim()
		const passcodePattern = String(formData.get('passcodePattern') || '').trim()
		const paymentMethodsJson = formData.get('paymentMethodsJson')
		const customerDescription = String(formData.get('customerDescription') || '').trim()
		const receivingNotes = String(formData.get('receivingNotes') || '').trim()
		const deviceEntryChecksRaw = formData.get('deviceEntryChecksJson')
		const deviceEntryChecksJson = typeof deviceEntryChecksRaw === 'string' ? deviceEntryChecksRaw.trim() : ''
		const deviceModelId = parseOptionalUuid(formData.get('deviceModelId'))
		const brand = String(formData.get('brand') || '').trim() || null
		const model = String(formData.get('model') || '').trim() || null
		const warrantyTemplateId = parseOptionalUuid(formData.get('warrantyTemplateId'))
		const warrantyTextRaw = String(formData.get('warrantyText') || '').trim()
		const formSellerUserId = String(formData.get('seller_user_id') || '').trim()
		const servicesJson = formData.get('servicesJson')
		const services = parseServicesJson(servicesJson)

		let deviceEntryChecks: any = null
		if (deviceEntryChecksJson) {
			try {
				deviceEntryChecks = JSON.parse(deviceEntryChecksJson)
			} catch {
				deviceEntryChecks = null
			}
		}

		const estimatedReadyAt = previsaoToISO(estimatedReadyAtRaw)

		if (!formOrderId) redirect(`/portal/ordens/${id}?error=dados_invalidos`)
		if (formOrderId !== id) redirect(`/portal/ordens/${id}?error=dados_invalidos`)
		if (!title) redirect(`/portal/ordens/${id}?error=titulo_obrigatorio`)
		if (!isValidStatus(status)) redirect(`/portal/ordens/${id}?error=status_invalido`)

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
				device_entry_checks, seller_user_id, closed_at,
				created_at`,
			)
			.eq('id', id)
			.maybeSingle()

		if (fetchExistingError) {
			console.error('[order-save-fetch]', {
				orderId: id,
				code: fetchExistingError.code,
				message: fetchExistingError.message,
				details: fetchExistingError.details,
				hint: fetchExistingError.hint,
			})
			const saveQs = new URLSearchParams()
			saveQs.set('error', 'nao_foi_possivel_salvar')
			const ec = String(fetchExistingError.code || '').trim().slice(0, 48)
			const emRaw = [fetchExistingError.message, fetchExistingError.details, fetchExistingError.hint]
				.filter(Boolean)
				.join(' — ')
			const em = String(emRaw || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 320)
			if (ec) saveQs.set('ec', ec)
			if (em) saveQs.set('em', em)
			redirect(`/portal/ordens/${id}?${saveQs.toString()}`)
		}

		if (!existing) {
			redirect(`/portal/ordens/${id}?error=ordem_nao_encontrada`)
		}

		const minPrevisaoMs = existing.created_at
			? new Date(String(existing.created_at)).getTime()
			: Date.now()
		if (estimatedReadyAt && new Date(estimatedReadyAt).getTime() < minPrevisaoMs - 60_000) {
			redirect(`/portal/ordens/${id}?error=previsao_invalida`)
		}
		const isOrderFinalized = existing && FINALIZED_STATUSES.has(existing.status)
		if (isOrderFinalized && role !== 'admin') {
			redirect(`/portal/ordens/${id}?error=ordem_finalizada`)
		}
		const updatePayload: Record<string, unknown> = {
			title,
			status,
			imei: imei || null,
			color: color || null,
			is_warranty: isWarranty,
			estimated_ready_at: estimatedReadyAt,
			passcode_type: (passcodeType === 'text' || passcodeType === 'pattern') ? passcodeType : null,
			passcode_text: passcodeType === 'text' ? (passcodeText || null) : null,
			passcode_pattern: passcodeType === 'pattern' ? (passcodePattern || null) : null,
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
		if (role === 'admin' && formSellerUserId) {
			const { data: sellerUser } = await supabase
				.from('users')
				.select('id')
				.eq('id', formSellerUserId)
				.in('role', ['admin', 'staff'])
				.maybeSingle()
			if (sellerUser?.id) updatePayload.seller_user_id = sellerUser.id
		}
		if (FINALIZED_STATUSES.has(status)) {
			updatePayload.closed_at = new Date().toISOString()
		}
		const { error } = await supabase
			.from('service_orders')
			.update(updatePayload)
			.eq('id', id)

		if (error) {
			const saveQs = new URLSearchParams()
			saveQs.set('error', 'nao_foi_possivel_salvar')
			const ec = String(error.code || '').trim().slice(0, 48)
			const emRaw = [error.message, error.details, error.hint]
				.filter(Boolean)
				.join(' — ')
			const em = String(emRaw || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 320)
			if (ec) saveQs.set('ec', ec)
			if (em) saveQs.set('em', em)
			console.error('[order-save]', { orderId: id, code: error.code, message: error.message, details: error.details, hint: error.hint })
			redirect(`/portal/ordens/${id}?${saveQs.toString()}`)
		}

		const diffRows = buildOrderEditDiff(existing as Record<string, unknown>, updatePayload)
		if (diffRows.length > 0) {
			const editedAt = new Date().toISOString()
			const { error: histErr } = await supabase
				.from('service_order_edit_history')
				.insert(
					diffRows.map((r) => ({
						service_order_id: id,
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
				orderId: id,
				previousStatus,
				nextStatus,
				services: servicesForStock,
				actorUserId: user.id,
			})
		} catch (_) {}

		redirect(`/portal/ordens/${id}?ok=1`)
	}

	async function deleteOrderAction(formData: FormData) {
		'use server'

		const orderId = String(formData.get('orderId') || '').trim()
		if (!orderId) redirect('/portal/ordens?error=dados_invalidos')

		const { user, role } = await getPortalAuth()
		if (!user) redirect('/portal/login')

		const normalizedRole = role === 'customer' ? 'user' : role
		if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
		if (normalizedRole !== 'admin') redirect(`/portal/ordens/${orderId}?error=sem_permissao`)

		const supabase = await createSupabaseServerClient()
		const { error } = await supabase
			.from('service_orders')
			.delete()
			.eq('id', orderId)

		if (error) redirect(`/portal/ordens/${id}?error=nao_foi_possivel_excluir`)

		redirect('/portal/ordens?ok=1')
	}

	const isFinalized = FINALIZED_STATUSES.has(order.status)
	const formDisabled = isFinalized && role !== 'admin'
	const canEditDeviceModelWhenFinalized = isAdmin && isFinalized
	const deviceModelDisabled = isFinalized && !canEditDeviceModelWhenFinalized
	const openServicesModalInitially = String(servicesModal || '').trim() === '1'

	return (
		<div className="max-w-4xl space-y-6 pb-24">
			<OrdemDetalheToastClient />

			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div className="flex flex-col gap-1.5">
					<h1 className="text-2xl font-bold">Editar Ordem #{order.display_number ?? order.id}</h1>
					<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<OrderStatusBadge status={order.status} />
						<span>
							Criada em {formatDateTimeBr(order.created_at)} •{' '}
							{order.closed_at
								? `Finalizada em ${formatDateTimeBr(order.closed_at)}`
								: `Atualizada em ${formatDateTimeBr(order.updated_at)}`}
						</span>
					</div>
				</div>

				<div className="flex items-center gap-2 flex-wrap">
					<OrderEditHistoryDialog orderId={order.id} isAdmin={isAdmin} />
					<OrdemPrintButton orderId={order.id} />
					<OrdemLabelPrintButton orderId={order.id} />
					<OrdemActionsMenu
						orderId={order.id}
						publicOrderPath={order.share_token ? `/os/${order.share_token}` : null}
						displayNumber={order.display_number ?? order.id}
						title={order.title}
						customerName={customer?.is_company ? (customer?.company_name ?? '') : (customer?.full_name ?? '')}
						device={deviceString || '-'}
						status={order.status}
						estimatedReadyAt={order.estimated_ready_at}
						mobilePhone={customer?.mobile_phone}
						email={customer?.email}
						isFinalized={isFinalized}
						canDelete={role === 'admin'}
						deleteOrderAction={deleteOrderAction}
					/>
				</div>
			</div>

			<OrderCustomerCard customer={customer} />

			<Card>
				<CardHeader>
					<CardTitle >Informações do Aparelho</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					<OrderDeviceSelector
						initialValue={{
							deviceModelId: (deviceModel as { id?: string })?.id ?? order.device_model_id ?? null,
							brand: brandName || order.brand || null,
							deviceType: deviceTypeName || null,
							model: (deviceModel as any)?.model ?? order.model ?? null,
						}}
						initialDeviceModels={deviceModels}
						formId="order-edit-form"
						disabled={deviceModelDisabled}
					/>
					<div className="grid md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="color">Cor</Label>
							<Input id="color" name="color" form="order-edit-form" defaultValue={order.color || ''} placeholder="Ex: Preto, Prateado" disabled={formDisabled} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="imei">Número de série / IMEI</Label>
							<Input id="imei" name="imei" form="order-edit-form" defaultValue={order.imei || ''} placeholder="Digite o número" disabled={formDisabled} />
						</div>
					</div>
					<OrderPasscodeFields
						defaultPasscodeType={order.passcode_type === 'text' || order.passcode_type === 'pattern' ? order.passcode_type : 'none'}
						defaultPasscodeText={order.passcode_text || ''}
						defaultPasscodePattern={order.passcode_pattern || ''}
						formId="order-edit-form"
						disabled={formDisabled}
					/>
				</CardContent>
			</Card>

			<OrderServicesTotalProvider initialTotal={order.services_total_cents ?? 0}>
				<form
					id="order-edit-form"
					action={updateOrderAction}
					className="space-y-6"
					key={`${order.id}-${order.updated_at ?? order.status}`}
				>
					<input type="hidden" name="orderId" value={order.id} />
					<input type="hidden" name="status" value={order.status} />

					<Card>
						<CardHeader>
							<CardTitle>Informações da assistência</CardTitle>
							<CardDescription>Do título até as fotos de entrada do aparelho.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="space-y-2 md:col-span-2">
									<Label htmlFor="title">Título</Label>
									<Input id="title" name="title" defaultValue={order.title} placeholder="Título" disabled={formDisabled} />
								</div>
								<div className="space-y-2">
									<Label htmlFor={isAdmin ? 'seller_user_id' : 'sellerDisplayName'}>Vendedor</Label>
									{isAdmin ? (
										<select
											id="seller_user_id"
											name="seller_user_id"
											defaultValue={sellerUserId || sellerOptions[0]?.id || ''}
											className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm"
											disabled={formDisabled}
										>
											{sellerOptions.map((u) => (
												<option key={u.id} value={u.id}>
													{String(u.full_name || u.email || u.id).trim() || '(Sem nome)'}
												</option>
											))}
										</select>
									) : (
										<Input id="sellerDisplayName" value={sellerDisplayName} readOnly disabled={formDisabled} />
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
									<PrevisaoInput
										id="estimatedReadyAt"
										name="estimatedReadyAt"
										min={getMinPrevisaoForEdit(order.created_at)}
										defaultValue={formatDateTimeLocal(order.estimated_ready_at)}
										disabled={formDisabled}
									/>
								</div>
								<div className="flex items-center gap-2 rounded-md border p-3">
									<input
										id="isWarranty"
										name="isWarranty"
										type="checkbox"
										defaultChecked={Boolean(order.is_warranty)}
										disabled={formDisabled}
									/>
									<Label htmlFor="isWarranty" className="cursor-pointer">Serviço em garantia</Label>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="customerDescription">Descrição</Label>
									<OsAssistAiIconButton fieldId="customerDescription" device={deviceString} disabled={formDisabled} />
								</div>
								<Textarea id="customerDescription" name="customerDescription" defaultValue={order.customer_description || ''} placeholder="Texto que o cliente vê" disabled={formDisabled} />
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="receivingNotes">Observações do recebimento</Label>
									<OsAssistAiIconButton fieldId="receivingNotes" device={deviceString} disabled={formDisabled} />
								</div>
								<Textarea id="receivingNotes" name="receivingNotes" defaultValue={order.receiving_notes || ''} placeholder="Checklist, avarias, acessórios, etc." disabled={formDisabled} />
							</div>

							<OrderDeviceEntryChecksEditor
								initialValue={order.device_entry_checks ?? null}
								disabled={formDisabled}
								formId="order-edit-form"
							/>

							<OrderEntryPhotos orderId={order.id} initialPhotoCount={entryPhotoCount} disabled={formDisabled} />
						</CardContent>
					</Card>

					<OrderServicesCard
						initialServices={(order.services as Array<{ description?: string; valueCents?: number; costCents?: number }>) ?? []}
						inputName="servicesJson"
						formId="order-edit-form"
						disabled={formDisabled}
						advancedInitiallyOpen={openServicesModalInitially}
					/>

					<Card>
						<CardHeader>
							<CardTitle>Informações sobre a assistência</CardTitle>
						</CardHeader>
						<CardContent>
							<OrderAssistanceChat
								orderId={order.id}
								disabled={formDisabled}
								assistanceAiContext={{
									device: deviceString || undefined,
									customerDescription: order.customer_description || '',
									receivingNotes: order.receiving_notes || '',
								}}
							/>
						</CardContent>
					</Card>

					{Array.isArray(warrantyTemplates) && warrantyTemplates.length > 0 ? (
						<Card>
							<CardHeader>
								<CardTitle>Garantia</CardTitle>
								<CardDescription>
									Modelo e texto exibidos na impressão e na visão pública da OS.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<OrderWarrantySelector
									templates={warrantyTemplates as Array<{ id: string; name: string; body: string; is_active?: boolean; is_default?: boolean }>}
									initialTemplateId={(order.warranty_template_id as string | null) ?? null}
									initialText={(order.warranty_text as string | null) ?? null}
									formId="order-edit-form"
									disabled={formDisabled}
								/>
							</CardContent>
						</Card>
					) : null}

					<OrderPaymentMethodsCard
						defaultValue={parseOrderPaymentMethods(order)}
						formId="order-edit-form"
						disabled={formDisabled}
					/>

					<Card>
						<CardHeader>
							<CardTitle>Descrição interna</CardTitle>
							<CardDescription>Anotações visíveis só para a equipe (não aparecem para o cliente).</CardDescription>
						</CardHeader>
						<CardContent>
							<OrderInternalCommentsChat orderId={order.id} disabled={formDisabled} deviceContext={deviceString || undefined} />
						</CardContent>
					</Card>

					<div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
						<div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
							<Button variant="outline" asChild>
								<Link href="/portal/ordens">{isFinalized ? 'Voltar à lista' : 'Voltar'}</Link>
							</Button>
							{!formDisabled && <UpdateOrderSubmitButton />}
						</div>
					</div>
				</form>
			</OrderServicesTotalProvider>
		</div>
	)
}

