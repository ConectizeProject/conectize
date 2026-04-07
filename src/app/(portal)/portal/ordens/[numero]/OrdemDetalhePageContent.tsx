import {
	OrderDeviceSelector,
	OrderPaymentMethodsCard,
	OrderServicesCard,
	OrderServicesTotalProvider,
	OrderStatusBadge,
	OrderWarrantySelector,
	OsAssistAiIconButton,
} from '@/components/orders'
import { PrevisaoInput } from '@/components/previsao-input'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { isFinalizedOrderStatus } from '@/lib/orders/order-status'
import { getOrdemPortalPathSegment } from '@/lib/orders/ordem-portal-path'
import {
	getMinPrevisaoForEdit,
} from '@/lib/utils/previsao-ordem'
import Link from 'next/link'
import { OrderFormActionBar } from '../OrderFormActionBar'
import { OrdemActionsMenu } from './OrdemActionsMenu'
import { OrdemDetalheToastClient } from './OrdemDetalheToastClient'
import { OrdemLabelPrintButton } from './OrdemLabelPrintButton'
import { OrderAssistanceChat } from './OrderAssistanceChat'
import { OrderCustomerCard } from './OrderCustomerCard'
import { OrderDeviceEntryChecksEditor } from './OrderDeviceEntryChecksEditor'
import { OrderEntryPhotos } from './OrderEntryPhotos'
import { OrderInternalCommentsChat } from './OrderInternalCommentsChat'
import { OrderPasscodeFields } from './OrderPasscodeFields'
import { UpdateOrderSubmitButton } from './UpdateOrderSubmitButton'
import {
	deleteOrderAction,
	updateOrderAction,
} from './order-detail-actions'
import { formatDateTimeLocal, parseOrderPaymentMethods } from './order-detail-helpers'
import type { ServiceOrderDetail } from './service-order-detail-types'

type WarrantyTemplateRow = {
	id: string
	name: string
	body: string
	is_active?: boolean
	is_default?: boolean
}

type SellerOption = {
	id: string
	full_name: string | null
	email: string | null
}

type Props = {
	order: ServiceOrderDetail
	customer: Record<string, unknown> | null
	deviceModel: Record<string, unknown> | null
	deviceString: string
	brandName: string
	deviceTypeName: string
	deviceModels: Awaited<ReturnType<typeof fetchDeviceModelsForSelector>>
	warrantyTemplates: WarrantyTemplateRow[] | null
	sellerUserId: string | null
	sellerDisplayName: string
	sellerOptions: SellerOption[]
	entryPhotoCount: number
	exitPhotoCount: number
	role: string
	isAdmin: boolean
	/** Abre o modal avançado de serviços quando `?servicesModal=1` */
	openServicesModalInitially: boolean
}

export function OrdemDetalhePageContent (props: Props) {
	const {
		order,
		customer,
		deviceModel,
		deviceString,
		brandName,
		deviceTypeName,
		deviceModels,
		warrantyTemplates,
		sellerUserId,
		sellerDisplayName,
		sellerOptions,
		entryPhotoCount,
		exitPhotoCount,
		role,
		isAdmin,
		openServicesModalInitially,
	} = props

	const isFinalized = isFinalizedOrderStatus(order.status)
	const formDisabled = isFinalized && role !== 'admin'
	const canEditDeviceModelWhenFinalized = isAdmin && isFinalized
	const deviceModelDisabled = isFinalized && !canEditDeviceModelWhenFinalized

	return (
		<div className="max-w-4xl space-y-6 pb-24">
			<OrdemDetalheToastClient />

			<div className="space-y-1.5">
				<div>
					<OrderStatusBadge status={order.status} />
				</div>

				<div className="flex items-start justify-between gap-4 flex-wrap">
					<h1 className="text-2xl font-bold">
						Editar Ordem #{order.display_number ?? order.id}
					</h1>

					<div className="flex items-center gap-2 flex-wrap justify-end">
						<OrdemLabelPrintButton orderId={order.id} />
						<OrdemActionsMenu
							orderId={order.id}
							publicOrderPath={
								order.share_token ? `/os/${order.share_token}` : null
							}
							displayNumber={order.display_number ?? order.id}
							title={order.title}
							customerName={
								customer?.is_company
									? String(customer?.company_name ?? '')
									: String(customer?.full_name ?? '')
							}
							device={deviceString || '-'}
							status={order.status}
							estimatedReadyAt={order.estimated_ready_at ?? null}
							mobilePhone={customer?.mobile_phone as string | undefined}
							email={customer?.email as string | undefined}
							isFinalized={isFinalized}
							canDelete={role === 'admin'}
							deleteOrderAction={deleteOrderAction}
							isAdmin={isAdmin}
							deviceExitChecks={order.device_exit_checks ?? null}
							exitPhotoCount={exitPhotoCount}
						/>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
					<span>
						Criada em {formatDateTimeBr(order.created_at)} •{' '}
						{order.closed_at
							? `Finalizada em ${formatDateTimeBr(order.closed_at)}`
							: `Atualizada em ${formatDateTimeBr(order.updated_at)}`}
					</span>
				</div>
			</div>

			<OrderCustomerCard customer={customer} />

			<Card>
				<CardHeader className="space-y-0 p-5 pb-3">
					<CardTitle className="text-lg font-semibold tracking-tight">
						Informações do Aparelho
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6 p-5 pt-0">
					<OrderDeviceSelector
						initialValue={{
							deviceModelId:
								(deviceModel as { id?: string })?.id ??
								order.device_model_id ??
								null,
							brand: brandName || order.brand || null,
							deviceType: deviceTypeName || null,
							model: (deviceModel as { model?: string })?.model ?? order.model ?? null,
						}}
						initialDeviceModels={deviceModels}
						formId="order-edit-form"
						disabled={deviceModelDisabled}
					/>
					<div className="grid md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="color">Cor</Label>
							<Input
								id="color"
								name="color"
								form="order-edit-form"
								defaultValue={String(order.color || '')}
								placeholder="Ex: Preto, Prateado"
								disabled={formDisabled}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="imei">Número de série / IMEI</Label>
							<Input
								id="imei"
								name="imei"
								form="order-edit-form"
								defaultValue={String(order.imei || '')}
								placeholder="Digite o número"
								disabled={formDisabled}
							/>
						</div>
					</div>
					<OrderPasscodeFields
						defaultPasscodeType={
							order.passcode_type === 'text' ||
							order.passcode_type === 'pattern'
								? order.passcode_type
								: 'none'
						}
						defaultPasscodeText={String(order.passcode_text || '')}
						defaultPasscodePattern={String(order.passcode_pattern || '')}
						formId="order-edit-form"
						disabled={formDisabled}
					/>
				</CardContent>
			</Card>

			<OrderServicesTotalProvider
				initialTotal={order.services_total_cents ?? 0}
			>
				<form
					id="order-edit-form"
					action={updateOrderAction}
					className="space-y-6"
					key={`${order.id}-${order.updated_at ?? order.status}`}
				>
					<input type="hidden" name="orderId" value={order.id} />
					<input type="hidden" name="status" value={order.status} />

					<Card>
						<CardHeader className="p-5">
							<CardTitle>Informações da assistência</CardTitle>
							<CardDescription>
								Do título até as fotos de entrada do aparelho.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6 p-5 pt-0">
							<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="space-y-2 md:col-span-2">
									<Label htmlFor="title">Título</Label>
									<Input
										id="title"
										name="title"
										defaultValue={order.title}
										placeholder="Título"
										disabled={formDisabled}
									/>
								</div>
								<div className="space-y-2">
									<Label
										htmlFor={isAdmin ? 'seller_user_id' : 'sellerDisplayName'}
									>
										Vendedor
									</Label>
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
													{String(u.full_name || u.email || u.id).trim() ||
														'(Sem nome)'}
												</option>
											))}
										</select>
									) : (
										<Input
											id="sellerDisplayName"
											value={sellerDisplayName}
											readOnly
											disabled={formDisabled}
										/>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="estimatedReadyAt">
										Previsão (data e hora)
									</Label>
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
									<Label htmlFor="isWarranty" className="cursor-pointer">
										Serviço em garantia
									</Label>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="customerDescription">Descrição</Label>
									<OsAssistAiIconButton
										fieldId="customerDescription"
										device={deviceString}
										disabled={formDisabled}
									/>
								</div>
								<Textarea
									id="customerDescription"
									name="customerDescription"
									defaultValue={String(order.customer_description || '')}
									placeholder="Texto que o cliente vê"
									disabled={formDisabled}
								/>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<Label htmlFor="receivingNotes">
										Observações do recebimento
									</Label>
									<OsAssistAiIconButton
										fieldId="receivingNotes"
										device={deviceString}
										disabled={formDisabled}
									/>
								</div>
								<Textarea
									id="receivingNotes"
									name="receivingNotes"
									defaultValue={String(order.receiving_notes || '')}
									placeholder="Checklist, avarias, acessórios, etc."
									disabled={formDisabled}
								/>
							</div>

							<OrderDeviceEntryChecksEditor
								initialValue={order.device_entry_checks ?? null}
								disabled={formDisabled}
								formId="order-edit-form"
							/>

							<OrderEntryPhotos
								orderId={order.id}
								portalPathSegment={getOrdemPortalPathSegment(order)}
								initialPhotoCount={entryPhotoCount}
								disabled={formDisabled}
							/>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="p-5">
							<CardTitle>Considerações da assistência</CardTitle>
							<CardDescription>
								Checklist e fotos na saída do aparelho. Registro
								independente da entrada, para comparar antes e
								depois.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6 p-5 pt-0">
							<OrderDeviceEntryChecksEditor
								initialValue={order.device_exit_checks ?? null}
								disabled={formDisabled}
								formId="order-edit-form"
								variant="exit"
							/>
							<OrderEntryPhotos
								orderId={order.id}
								portalPathSegment={getOrdemPortalPathSegment(order)}
								initialPhotoCount={exitPhotoCount}
								disabled={formDisabled}
								photoStage="exit"
							/>
						</CardContent>
					</Card>

					<OrderServicesCard
						initialServices={
							(order.services as Array<{
								description?: string
								valueCents?: number
								costCents?: number
							}>) ?? []
						}
						inputName="servicesJson"
						formId="order-edit-form"
						disabled={formDisabled}
						advancedInitiallyOpen={openServicesModalInitially}
						currentStatus={order.status}
						statusInputName="status"
					/>

					<Card>
						<CardHeader className="p-5">
							<CardTitle>Informações sobre a assistência</CardTitle>
						</CardHeader>
						<CardContent className="p-5 pt-0">
							<OrderAssistanceChat
								orderId={order.id}
								assistanceAiContext={{
									device: deviceString || undefined,
									customerDescription: String(order.customer_description || ''),
									receivingNotes: String(order.receiving_notes || ''),
								}}
							/>
						</CardContent>
					</Card>

					{Array.isArray(warrantyTemplates) && warrantyTemplates.length > 0 ? (
						<Card>
							<CardHeader className="p-5">
								<CardTitle>Garantia</CardTitle>
								<CardDescription>
									Modelo e texto exibidos na impressão e na visão pública da OS.
								</CardDescription>
							</CardHeader>
							<CardContent className="p-5 pt-0">
								<OrderWarrantySelector
									templates={warrantyTemplates}
									initialTemplateId={
										(order.warranty_template_id as string | null) ?? null
									}
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
						<CardHeader className="p-5">
							<CardTitle>Descrição interna</CardTitle>
							<CardDescription>
								Anotações visíveis só para a equipe (não aparecem para o
								cliente).
							</CardDescription>
						</CardHeader>
						<CardContent className="p-5 pt-0">
							<OrderInternalCommentsChat
								orderId={order.id}
								disabled={formDisabled}
								deviceContext={deviceString || undefined}
							/>
						</CardContent>
					</Card>

					<OrderFormActionBar>
						<Button
							variant="ghost"
							asChild
							className="font-medium text-muted-foreground hover:text-foreground"
						>
							<Link href="/portal/ordens">
								{isFinalized ? 'Voltar à lista' : 'Voltar'}
							</Link>
						</Button>
						{!formDisabled && <UpdateOrderSubmitButton />}
					</OrderFormActionBar>
				</form>
			</OrderServicesTotalProvider>
		</div>
	)
}
