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
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'
import { formatDateBr, formatDateTimeBr } from '@/lib/utils/format-date'
import { OrderDeviceSelector, OrderServicesCard } from '@/components/orders'
import { OrderCustomerCard } from './OrderCustomerCard'
import { OrderPasscodeFields } from './OrderPasscodeFields'
import { OrdemDetalheToastClient } from './OrdemDetalheToastClient'
import { OrdemLabelPrintButton } from './OrdemLabelPrintButton'
import { OrdemPrintButton } from './OrdemPrintButton'
import { OrdemActionsMenu } from './OrdemActionsMenu'
import { PrevisaoInput } from '@/components/previsao-input'
import { getMinPrevisaoForEdit, previsaoToISO, toDateTimeLocalInBrazil } from '@/lib/utils/previsao-ordem'
import { UpdateOrderSubmitButton } from './UpdateOrderSubmitButton'

export const dynamic = 'force-dynamic'

function formatStatus(status: string) {
	if (status === 'orcamento') return 'Orçamento'
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

function parseServicesJson(raw: unknown): { items: Array<{ description: string; valueCents: number; costCents: number }>; totalValueCents: number; totalCostCents: number } {
	if (!raw) return { items: [], totalValueCents: 0, totalCostCents: 0 }
	try {
		const parsed = JSON.parse(String(raw)) as { items?: unknown[]; totals?: { totalValueCents?: number; totalCostCents?: number } }
		const items = Array.isArray(parsed?.items) ? parsed.items : []
		const normalized = items
			.slice(0, 100)
			.map((item: unknown) => {
				const i = item as Record<string, unknown>
				return {
					description: String(i?.description ?? '').trim().slice(0, 240),
					valueCents: Math.max(0, Number(i?.valueCents ?? 0) || 0),
					costCents: Math.max(0, Number(i?.costCents ?? 0) || 0),
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
	searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function OrdemDetalhePage({ params, searchParams }: PageProps) {
	const { id } = await params
	const { error } = await searchParams

	const { user, role } = await getPortalAuth()
	if (!user) redirect('/portal/login')

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()
	const [{ data: order }, { data: companySettings }] = await Promise.all([
		supabase
			.from('service_orders')
			.select('id, display_number, status, title, imei, color, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, customer_description, internal_description, receiving_notes, assistance_info, device_model_id, brand, model, services, services_total_cents, services_cost_total_cents, created_at, updated_at, closed_at, share_token, seller_user_id, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date, zip_code, state, city, neighborhood, street, street_number, street_complement, referral_source, referral_source_other ), device_models ( id, brand, device_type, model )')
			.eq('id', id)
			.maybeSingle(),
		supabase.from('company_settings').select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url').eq('id', 1).maybeSingle(),
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

	const [sellerUser, staffAdminUsers] = await Promise.all([
		sellerUserId
			? supabase.from('users').select('id, full_name, email').eq('id', sellerUserId).maybeSingle()
			: Promise.resolve({ data: null }),
		isAdmin
			? supabase.from('users').select('id, full_name, email').in('role', ['admin', 'staff']).order('email')
			: Promise.resolve({ data: [] }),
	])

	const seller = sellerUser.data
	const sellerDisplayName = seller ? (String(seller.full_name || '').trim() || String(seller.email || '').trim() || '(Sem nome)') : ''
	const sellerOptions = (staffAdminUsers.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>

	const customer = getCustomerFromOrder(order)
	const deviceModel = getDeviceModelFromOrder(order)
	const deviceString = deviceModel
		? [deviceModel.brand, deviceModel.device_type, deviceModel.model].filter(Boolean).join(' ')
		: (order.brand || order.model ? [order.brand, order.model].filter(Boolean).join(' ') : '')

	async function updateOrderAction(formData: FormData) {
		'use server'

		const orderId = String(formData.get('orderId') || '').trim()
		const title = String(formData.get('title') || '').trim()
		const status = String(formData.get('status') || '').trim()
		const imei = String(formData.get('imei') || '').trim()
		const color = String(formData.get('color') || '').trim()
		const isWarranty = Boolean(formData.get('isWarranty'))
		const estimatedReadyAtRaw = String(formData.get('estimatedReadyAt') || '').trim()
		const passcodeType = String(formData.get('passcodeType') || '').trim()
		const passcodeText = String(formData.get('passcodeText') || '').trim()
		const passcodePattern = String(formData.get('passcodePattern') || '').trim()
		const customerDescription = String(formData.get('customerDescription') || '').trim()
		const internalDescription = String(formData.get('internalDescription') || '').trim()
		const receivingNotes = String(formData.get('receivingNotes') || '').trim()
		const assistanceInfo = String(formData.get('assistanceInfo') || '').trim()
		const deviceModelId = String(formData.get('deviceModelId') || '').trim()
		const formSellerUserId = String(formData.get('seller_user_id') || '').trim()
		const servicesJson = formData.get('servicesJson')
		const services = parseServicesJson(servicesJson)

		const estimatedReadyAt = previsaoToISO(estimatedReadyAtRaw)

		const minPrevisaoMs = order.created_at ? new Date(order.created_at).getTime() : Date.now()
		if (estimatedReadyAt && new Date(estimatedReadyAt).getTime() < minPrevisaoMs - 60_000) {
			redirect(`/portal/ordens/${id}?error=previsao_invalida`)
		}

		if (!orderId) redirect(`/portal/ordens/${id}?error=dados_invalidos`)
		if (!title) redirect(`/portal/ordens/${id}?error=titulo_obrigatorio`)
		if (!isValidStatus(status)) redirect(`/portal/ordens/${id}?error=status_invalido`)

		const { user, role } = await getPortalAuth()
		if (!user) redirect('/portal/login')

		const normalizedRole = role === 'customer' ? 'user' : role
		if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

		const supabase = await createSupabaseServerClient()
		const { data: existing } = await supabase
			.from('service_orders')
			.select('status')
			.eq('id', orderId)
			.maybeSingle()
		if (existing && FINALIZED_STATUSES.has(existing.status)) {
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
			customer_description: customerDescription || null,
			internal_description: internalDescription || null,
			receiving_notes: receivingNotes || null,
			assistance_info: assistanceInfo || null,
			device_model_id: deviceModelId || null,
			services: services.items,
			services_total_cents: services.totalValueCents,
			services_cost_total_cents: services.totalCostCents,
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
			.eq('id', orderId)

		if (error) redirect(`/portal/ordens/${id}?error=nao_foi_possivel_salvar`)

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
					<OrdemPrintButton orderId={order.id} />
					<OrdemLabelPrintButton orderId={order.id} />
					<OrdemActionsMenu
						orderId={order.id}
						publicOrderPath={order.share_token ? `/os/${order.share_token}` : null}
						displayNumber={order.display_number ?? order.id}
						title={order.title}
						customerName={customer?.is_company ? (customer?.company_name ?? '') : (customer?.full_name ?? '')}
						device={deviceModel ? `${deviceModel.brand} • ${deviceModel.device_type} • ${deviceModel.model}` : (order.brand || order.model ? `${order.brand || ''} ${order.model || ''}`.trim() : '-')}
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

			{error ? (
				<p className="text-sm text-destructive">
					{getOrdemErrorMessage(error)}
				</p>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle >Informações do Aparelho</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					<OrderDeviceSelector
						initialValue={{
							deviceModelId: (deviceModel as { id?: string })?.id ?? order.device_model_id ?? null,
							brand: deviceModel?.brand ?? order.brand ?? null,
							deviceType: deviceModel?.device_type ?? null,
							model: deviceModel?.model ?? order.model ?? null,
						}}
						formId="order-edit-form"
						disabled={isFinalized}
					/>
					<div className="grid md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="color">Cor</Label>
							<Input id="color" name="color" form="order-edit-form" defaultValue={order.color || ''} placeholder="Ex: Preto, Prateado" disabled={isFinalized} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="imei">Número de série / IMEI</Label>
							<Input id="imei" name="imei" form="order-edit-form" defaultValue={order.imei || ''} placeholder="Digite o número" disabled={isFinalized} />
						</div>
					</div>
					<OrderPasscodeFields
						defaultPasscodeType={order.passcode_type === 'text' || order.passcode_type === 'pattern' ? order.passcode_type : 'none'}
						defaultPasscodeText={order.passcode_text || ''}
						defaultPasscodePattern={order.passcode_pattern || ''}
						formId="order-edit-form"
						disabled={isFinalized}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent>
					<form id="order-edit-form" action={updateOrderAction} className="space-y-6" key={`${order.id}-${order.updated_at ?? order.status}`}>
						<input type="hidden" name="orderId" value={order.id} />
						<input type="hidden" name="status" value={order.status} />

						<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="title">Título</Label>
								<Input id="title" name="title" defaultValue={order.title} placeholder="Título" disabled={isFinalized} />
							</div>
							<div className="space-y-2">
								<Label htmlFor={isAdmin ? 'seller_user_id' : 'sellerDisplayName'}>Vendedor</Label>
								{isAdmin ? (
									<select
										id="seller_user_id"
										name="seller_user_id"
										defaultValue={sellerUserId || sellerOptions[0]?.id || ''}
										className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm"
										disabled={isFinalized}
									>
										{sellerOptions.map((u) => (
											<option key={u.id} value={u.id}>
												{String(u.full_name || u.email || u.id).trim() || '(Sem nome)'}
											</option>
										))}
									</select>
								) : (
									<Input id="sellerDisplayName" value={sellerDisplayName} readOnly disabled={isFinalized} />
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
								<PrevisaoInput
									id="estimatedReadyAt"
									name="estimatedReadyAt"
									min={getMinPrevisaoForEdit(order.created_at)}
									defaultValue={formatDateTimeLocal(order.estimated_ready_at)}
									disabled={isFinalized}
								/>
							</div>
							<div className="flex items-center gap-2 rounded-md border p-3">
								<input
									id="isWarranty"
									name="isWarranty"
									type="checkbox"
									defaultChecked={Boolean(order.is_warranty)}
									disabled={isFinalized}
								/>
								<Label htmlFor="isWarranty" className="cursor-pointer">Serviço em garantia</Label>
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="customerDescription">Descrição</Label>
								<OsAssistAiIconButton fieldId="customerDescription" device={deviceString} disabled={isFinalized} />
							</div>
							<Textarea id="customerDescription" name="customerDescription" defaultValue={order.customer_description || ''} placeholder="Texto que o cliente vê" disabled={isFinalized} />
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="receivingNotes">Observações do recebimento</Label>
								<OsAssistAiIconButton fieldId="receivingNotes" device={deviceString} disabled={isFinalized} />
							</div>
							<Textarea id="receivingNotes" name="receivingNotes" defaultValue={order.receiving_notes || ''} placeholder="Checklist, avarias, acessórios, etc." disabled={isFinalized} />
						</div>

						<OrderServicesCard
							initialServices={(order.services as Array<{ description?: string; valueCents?: number; costCents?: number }>) ?? []}
							inputName="servicesJson"
							formId="order-edit-form"
							disabled={isFinalized}
						/>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="internalDescription">Descrição interna</Label>
								<OsAssistAiIconButton fieldId="internalDescription" device={deviceString} disabled={isFinalized} />
							</div>
							<Textarea id="internalDescription" name="internalDescription" defaultValue={order.internal_description || ''} placeholder="Anotações internas" disabled={isFinalized} />
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="assistanceInfo">Informações sobre a assistência</Label>
								<OsAssistAiIconButton fieldId="assistanceInfo" device={deviceString} disabled={isFinalized} />
							</div>
							<Textarea id="assistanceInfo" name="assistanceInfo" defaultValue={order.assistance_info || ''} placeholder="Informações técnicas, serviços realizados, peças trocadas, etc." disabled={isFinalized} />
						</div>

						<div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
							<div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
								<Button variant="outline" asChild>
									<Link href="/portal/ordens">{isFinalized ? 'Voltar à lista' : 'Voltar'}</Link>
								</Button>
								{!isFinalized && <UpdateOrderSubmitButton />}
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}

