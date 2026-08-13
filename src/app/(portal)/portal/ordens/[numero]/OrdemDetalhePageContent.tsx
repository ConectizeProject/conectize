import {
	OrderPaymentMethodsCard,
	OrderServicesCard,
	OrderServicesTotalProvider,
	OrderStatusBadge,
	OrderWarrantySelector,
} from '@/components/orders'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { isFinalizedOrderStatus } from '@/lib/orders/order-status'
import { getOrdemPortalPathSegment } from '@/lib/orders/ordem-portal-path'
import {
	getMinPrevisaoForEdit,
} from '@/lib/utils/previsao-ordem'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import {
	OrderFormActionBar,
	orderFormActionBarFlowSpacerClassName,
} from '../OrderFormActionBar'
import { OrdemActionsMenu } from './OrdemActionsMenu'
import { OrdemDetalheToastClient } from './OrdemDetalheToastClient'
import { OrdemLabelPrintButton } from './OrdemLabelPrintButton'
import { OrderAssistanceChat } from './OrderAssistanceChat'
import { OrderCustomerCard, type OrderCustomer } from './OrderCustomerCard'
import { OrderDeviceEntryChecksEditor } from './OrderDeviceEntryChecksEditor'
import { OrderEntryPhotos } from './OrderEntryPhotos'
import { OrderInternalCommentsChat } from './OrderInternalCommentsChat'
import { OrderAssistInfoSection } from './OrderAssistInfoSection'
import { OrderDeviceInfoSection } from './OrderDeviceInfoSection'
import { UpdateOrderSubmitButton } from './UpdateOrderSubmitButton'
import {
	deleteOrderAction,
	updateOrderAction,
} from './order-detail-actions'
import { formatDateTimeLocal, parseOrderPaymentMethods } from './order-detail-helpers'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { parseOrderDiscountCommissionFromRow } from '@/lib/orders/order-discount-commission'
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
	assistancePhotoCount: number
	role: string
	isAdmin: boolean
	/** Abre o modal avançado de serviços quando `?servicesModal=1` */
	openServicesModalInitially: boolean
	/** Lojista B2B: somente leitura, sem dados internos da equipe */
	readOnly?: boolean
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
		assistancePhotoCount,
		role,
		isAdmin,
		openServicesModalInitially,
		readOnly = false,
	} = props

	const isPortalReadOnly = readOnly
	const isFinalized = isFinalizedOrderStatus(order.status)
	const formDisabled =
		isPortalReadOnly ||
		(isFinalized && role !== 'admin' && role !== 'platform_admin')
	const canEditDeviceModelWhenFinalized = isAdmin && isFinalized
	const deviceModelDisabled =
		isPortalReadOnly || (isFinalized && !canEditDeviceModelWhenFinalized)

	return (
		<div className="max-w-4xl shrink-0 space-y-6">
			<OrdemDetalheToastClient />

			<div className="space-y-1.5">
				<div>
					<OrderStatusBadge status={order.status} />
				</div>

				<div className="flex items-start justify-between gap-4 flex-wrap">
					<h1 className="text-2xl font-bold">
						{isPortalReadOnly ? 'Ordem' : 'Editar Ordem'} #{order.display_number ?? order.id}
					</h1>

					<div className="flex items-center gap-2 flex-wrap justify-end">
						{!isPortalReadOnly ? (
							<>
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
									canDelete={role === 'admin' || role === 'platform_admin'}
									deleteOrderAction={deleteOrderAction}
									isAdmin={isAdmin}
									deviceExitChecks={order.device_exit_checks ?? null}
									exitPhotoCount={exitPhotoCount}
									warrantyTemplateId={
										(order.warranty_template_id as string | null) ?? null
									}
									warrantyText={(order.warranty_text as string | null) ?? null}
								/>
							</>
						) : order.share_token ? (
							<Button variant="outline" size="sm" asChild>
								<Link href={`/os/${order.share_token}`} target="_blank" rel="noreferrer">
									Ver página pública
								</Link>
							</Button>
						) : null}
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

			<OrderCustomerCard
				orderId={order.id}
				customer={(customer as OrderCustomer | null) ?? null}
				disabled={formDisabled}
			/>

			<OrderDeviceInfoSection
				key={`device-${order.id}-${order.updated_at ?? ''}`}
				formId="order-edit-form"
				deviceString={deviceString}
				formDisabled={formDisabled}
				deviceModelDisabled={deviceModelDisabled}
				deviceModel={deviceModel}
				order={order}
				brandName={brandName}
				deviceTypeName={deviceTypeName}
				deviceModels={deviceModels}
			/>

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

					<OrderAssistInfoSection
						key={`assist-${order.id}-${order.updated_at ?? ''}`}
						formId="order-edit-form"
						formDisabled={formDisabled}
						orderId={order.id}
						portalPathSegment={getOrdemPortalPathSegment(order)}
						entryPhotoCount={entryPhotoCount}
						deviceString={deviceString}
						title={order.title}
						isWarranty={Boolean(order.is_warranty)}
						sellerUserId={sellerUserId}
						sellerDisplayName={sellerDisplayName}
						sellerOptions={sellerOptions}
						isAdmin={isAdmin}
						previsaoMin={getMinPrevisaoForEdit(order.created_at)}
						estimatedReadyAtDefault={formatDateTimeLocal(order.estimated_ready_at)}
						previsaoDisplay={
							order.estimated_ready_at
								? formatDateTimeBr(order.estimated_ready_at)
								: null
						}
						customerDescription={String(order.customer_description || '')}
						receivingNotes={String(order.receiving_notes || '')}
						deviceEntryChecks={order.device_entry_checks ?? null}
					/>

					<OrderServicesCard
						initialServices={
							(order.services as Array<{
								description?: string
								valueCents?: number
								costCents?: number
								unitValueCents?: number
								unitCostCents?: number
								kind?: 'service' | 'product'
								quantity?: number
								sourceProductId?: string | null
								noCost?: boolean
							}>) ?? []
						}
						inputName="servicesJson"
						formId="order-edit-form"
						disabled={formDisabled}
						advancedInitiallyOpen={openServicesModalInitially}
						currentStatus={order.status}
						statusInputName="status"
					/>

					{!isPortalReadOnly ? (
						<Card>
							<CardHeader className="p-5">
								<CardTitle>Informações sobre a assistência</CardTitle>
								<CardDescription>
									Comentários e fotos visíveis para o cliente no link público da OS.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6 p-5 pt-0">
								<OrderAssistanceChat
									orderId={order.id}
									assistanceAiContext={{
										device: deviceString || undefined,
										customerDescription: String(order.customer_description || ''),
										receivingNotes: String(order.receiving_notes || ''),
									}}
								/>
								<OrderEntryPhotos
									orderId={order.id}
									portalPathSegment={getOrdemPortalPathSegment(order)}
									initialPhotoCount={assistancePhotoCount}
									disabled={formDisabled}
									photoStage="assistance"
								/>
							</CardContent>
						</Card>
					) : null}

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

					{!isPortalReadOnly ? (
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
					) : null}

					<OrderPaymentMethodsCard
						defaultValue={parseOrderPaymentMethods(order)}
						formId="order-edit-form"
						disabled={formDisabled}
						teamUsers={sellerOptions}
						discountCommission={parseOrderDiscountCommissionFromRow(order)}
					/>

					<div aria-hidden className={orderFormActionBarFlowSpacerClassName} />
					<OrderFormActionBar>
						<Button
							variant="ghost"
							asChild
							className="font-medium text-muted-foreground hover:text-foreground"
						>
							<Link href={isPortalReadOnly ? '/portal/minhas-ordens' : '/portal/ordens'}>
								{isPortalReadOnly ? 'Voltar às ordens' : isFinalized ? 'Voltar à lista' : 'Voltar'}
							</Link>
						</Button>
						{!isPortalReadOnly ? (
							<Button
								variant="outline"
								asChild
								className="font-medium border-sky-600/70 text-sky-800 bg-sky-50/60 hover:bg-sky-100/90 hover:text-sky-900 dark:border-sky-500 dark:text-sky-200 dark:bg-sky-950/50 dark:hover:bg-sky-900/60"
							>
								<Link href="/portal/ordens/nova">
									<Plus className="mr-2 h-4 w-4" aria-hidden />
									Nova OS
								</Link>
							</Button>
						) : null}
						{!formDisabled && <UpdateOrderSubmitButton />}
					</OrderFormActionBar>
				</form>
			</OrderServicesTotalProvider>
		</div>
	)
}
