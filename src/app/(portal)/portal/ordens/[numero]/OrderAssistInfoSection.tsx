'use client'

import { OsAssistAiIconButton } from '@/components/orders'
import { PrevisaoInput } from '@/components/previsao-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChevronUp, Pencil } from 'lucide-react'
import { useState } from 'react'
import { OrderDeviceEntryChecksEditor } from './OrderDeviceEntryChecksEditor'
import { OrderEntryPhotos } from './OrderEntryPhotos'

export type OrderAssistSellerOption = {
	id: string
	full_name: string | null
	email: string | null
}

export type OrderAssistInfoSectionProps = {
	formId: string
	formDisabled: boolean
	orderId: string
	portalPathSegment: string
	entryPhotoCount: number
	deviceString: string
	title: string
	isWarranty: boolean
	sellerUserId: string | null
	sellerDisplayName: string
	sellerOptions: OrderAssistSellerOption[]
	isAdmin: boolean
	previsaoMin: string
	estimatedReadyAtDefault: string
	/** Já formatado para exibição no resumo (ex.: formatDateTimeBr) */
	previsaoDisplay: string | null
	customerDescription: string
	receivingNotes: string
	deviceEntryChecks: unknown
}

/** Campos enviados no formulário (título, vendedor, previsão, garantia, textos). Checklist e fotos ficam fora. */
function AssistTopFormFields(props: OrderAssistInfoSectionProps) {
	const {
		formDisabled,
		deviceString,
		title,
		isWarranty,
		sellerUserId,
		sellerDisplayName,
		sellerOptions,
		isAdmin,
		previsaoMin,
		estimatedReadyAtDefault,
		customerDescription,
		receivingNotes,
	} = props

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
				<div className="space-y-2 md:col-span-2">
					<Label htmlFor="title">Título</Label>
					<Input
						id="title"
						name="title"
						defaultValue={title}
						placeholder="Título"
						disabled={formDisabled}
					/>
				</div>
				<div className="space-y-2 md:col-span-1">
					<Label htmlFor={isAdmin ? 'seller_user_id' : 'sellerDisplayName'}>
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
									{String(u.full_name || u.email || u.id).trim() || '(Sem nome)'}
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
				<div className="space-y-2 md:col-span-1">
					<Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
					<PrevisaoInput
						id="estimatedReadyAt"
						name="estimatedReadyAt"
						min={previsaoMin}
						defaultValue={estimatedReadyAtDefault}
						disabled={formDisabled}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2 rounded-md border p-3">
				<input
					id="isWarranty"
					name="isWarranty"
					type="checkbox"
					defaultChecked={isWarranty}
					disabled={formDisabled}
				/>
				<Label htmlFor="isWarranty" className="cursor-pointer">
					Serviço em garantia
				</Label>
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
					defaultValue={customerDescription}
					placeholder="Texto que o cliente vê"
					disabled={formDisabled}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<Label htmlFor="receivingNotes">Observações do recebimento</Label>
					<OsAssistAiIconButton
						fieldId="receivingNotes"
						device={deviceString}
						disabled={formDisabled}
					/>
				</div>
				<Textarea
					id="receivingNotes"
					name="receivingNotes"
					defaultValue={receivingNotes}
					placeholder="Checklist, avarias, acessórios, etc."
					disabled={formDisabled}
				/>
			</div>
		</div>
	)
}

function AssistSummaryReadOnly(props: {
	title: string
	sellerDisplayName: string
	previsaoDisplay: string | null
	customerDescription: string
}) {
	const { title, sellerDisplayName, previsaoDisplay, customerDescription } = props
	const previsaoResumo = previsaoDisplay?.trim() || '—'
	const desc = String(customerDescription || '').trim()

	return (
		<div className="space-y-6">
			<div className="grid min-w-0 grid-cols-1 gap-4 text-sm md:grid-cols-4 md:gap-4">
				<div className="min-w-0 space-y-1 md:col-span-2">
					<div className="text-muted-foreground">Título</div>
					<div className="font-medium text-foreground break-words">
						{title.trim() || '—'}
					</div>
				</div>
				<div className="min-w-0 space-y-1 md:col-span-1">
					<div className="text-muted-foreground">Vendedor</div>
					<div className="font-medium text-foreground break-words">
						{sellerDisplayName.trim() || '—'}
					</div>
				</div>
				<div className="min-w-0 space-y-1 md:col-span-1">
					<div className="text-muted-foreground">Previsão</div>
					<div className="font-medium text-foreground break-words">{previsaoResumo}</div>
				</div>
			</div>

			<div className="min-w-0 space-y-1 text-sm">
				<div className="text-muted-foreground">Descrição</div>
				<div className="font-medium text-foreground break-words whitespace-pre-wrap">
					{desc || '—'}
				</div>
			</div>
		</div>
	)
}

function AssistChecksAndPhotos(props: OrderAssistInfoSectionProps) {
	const {
		formDisabled,
		orderId,
		portalPathSegment,
		entryPhotoCount,
		deviceEntryChecks,
		formId,
	} = props

	return (
		<div className="space-y-6">
			<OrderDeviceEntryChecksEditor
				initialValue={deviceEntryChecks ?? null}
				disabled={formDisabled}
				formId={formId}
			/>
			<OrderEntryPhotos
				orderId={orderId}
				portalPathSegment={portalPathSegment}
				initialPhotoCount={entryPhotoCount}
				disabled={formDisabled}
			/>
		</div>
	)
}

export function OrderAssistInfoSection(props: OrderAssistInfoSectionProps) {
	const { formDisabled, isWarranty } = props

	const [editing, setEditing] = useState(false)
	const useCollapsible = !formDisabled

	if (!useCollapsible) {
		return (
			<Card>
				<CardContent className="flex flex-col gap-6 p-5">
					<AssistTopFormFields {...props} />
					<AssistChecksAndPhotos {...props} />
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="relative">
			<div
				className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-1 rounded-md border bg-background/95 p-0.5 pl-1.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/80"
				role="toolbar"
				aria-label="Ações da assistência"
			>
				{isWarranty ? (
					<Badge variant="secondary" className="shrink-0 font-normal">
						Garantia
					</Badge>
				) : null}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0"
					onClick={() => setEditing((v) => !v)}
					aria-label={
						editing
							? 'Recolher informações da assistência'
							: 'Editar informações da assistência'
					}
				>
					{editing ? (
						<ChevronUp className="h-3.5 w-3.5" aria-hidden />
					) : (
						<Pencil className="h-3.5 w-3.5" aria-hidden />
					)}
				</Button>
			</div>
			<CardContent
				className={'flex flex-col p-5'}
			>
				{!editing ? (
					<AssistSummaryReadOnly
						title={props.title}
						sellerDisplayName={props.sellerDisplayName}
						previsaoDisplay={props.previsaoDisplay}
						customerDescription={props.customerDescription}
					/>
				) : null}

				<div className={cn(!editing && 'hidden')}>
					<AssistTopFormFields {...props} />
				</div>

				<AssistChecksAndPhotos {...props} />
			</CardContent>
		</Card>
	)
}
