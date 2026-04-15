'use client'

import { OrderDeviceSelector } from '@/components/orders'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { ChevronUp, Pencil } from 'lucide-react'
import { useState } from 'react'
import { OrderPasscodeFields } from './OrderPasscodeFields'

const DEVICE_SUMMARY_HIDDEN_TOKENS = new Set([
	'apple',
	'smartfone',
	'smartphone',
])

function isHiddenDeviceToken(part: string): boolean {
	return DEVICE_SUMMARY_HIDDEN_TOKENS.has(part.trim().toLowerCase())
}

function buildFilteredDeviceParts(
	brandName: string,
	deviceTypeName: string,
	model: string | null | undefined,
): string[] {
	return [brandName, deviceTypeName, String(model || '').trim()]
		.map((s) => String(s || '').trim())
		.filter(Boolean)
		.filter((p) => !isHiddenDeviceToken(p))
}

function buildAparelhoSummaryLine(
	brandName: string,
	deviceTypeName: string,
	model: string | null | undefined,
	color: string | null | undefined,
): string {
	const parts = buildFilteredDeviceParts(brandName, deviceTypeName, model)
	const colorTrim = String(color || '').trim()
	const withColor = colorTrim ? [...parts, colorTrim] : parts
	const line = withColor.join(' • ')
	return line || '—'
}

type OrderDeviceInfoSectionProps = {
	formId: string
	deviceString: string
	formDisabled: boolean
	deviceModelDisabled: boolean
	deviceModel: Record<string, unknown> | null
	order: {
		device_model_id?: string | null
		brand?: string | null
		model?: string | null
		color?: string | null
		device_location?: string | null
		imei?: string | null
		passcode_type?: string | null
		passcode_text?: string | null
		passcode_pattern?: string | null
	}
	brandName: string
	deviceTypeName: string
	deviceModels: Awaited<ReturnType<typeof fetchDeviceModelsForSelector>>
}

function buildPasscodeSummaryParts(order: OrderDeviceInfoSectionProps['order']): {
	label: string
	value: string
} {
	const t = order.passcode_type
	if (t === 'text') {
		const v = String(order.passcode_text || '').trim()
		return {
			label: 'Senha do aparelho (texto)',
			value: v || '—',
		}
	}
	if (t === 'pattern') {
		const v = String(order.passcode_pattern || '').trim()
		const showRaw = v.length > 0 && v.length <= 48
		return {
			label: 'Senha do aparelho (forma)',
			value: v ? (showRaw ? v : 'Registrada') : '—',
		}
	}
	return {
		label: 'Senha do aparelho',
		value: 'Não informada',
	}
}

function DeviceFormFields(props: Omit<OrderDeviceInfoSectionProps, 'deviceString'>) {
	const {
		formId,
		formDisabled,
		deviceModelDisabled,
		deviceModel,
		order,
		brandName,
		deviceTypeName,
		deviceModels,
	} = props

	return (
		<div className="space-y-6">
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
				formId={formId}
				disabled={deviceModelDisabled}
			/>
			<div className="grid md:grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="color">Cor</Label>
					<Input
						id="color"
						name="color"
						form={formId}
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
						form={formId}
						defaultValue={String(order.imei || '')}
						placeholder="Digite o número"
						disabled={formDisabled}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor="deviceLocation">Localização do aparelho</Label>
				<Input
					id="deviceLocation"
					name="deviceLocation"
					form={formId}
					defaultValue={String(order.device_location || '')}
					placeholder="Ex: Bancada 2, gaveta A, laboratório…"
					disabled={formDisabled}
				/>
			</div>
			<OrderPasscodeFields
				defaultPasscodeType={
					order.passcode_type === 'text' || order.passcode_type === 'pattern'
						? order.passcode_type
						: 'none'
				}
				defaultPasscodeText={String(order.passcode_text || '')}
				defaultPasscodePattern={String(order.passcode_pattern || '')}
				formId={formId}
				disabled={formDisabled}
			/>
		</div>
	)
}

export function OrderDeviceInfoSection(props: OrderDeviceInfoSectionProps) {
	const { formDisabled, brandName, deviceTypeName, deviceModel, order } = props

	const [editing, setEditing] = useState(false)
	const useCollapsible = !formDisabled

	const aparelhoLine = buildAparelhoSummaryLine(
		brandName,
		deviceTypeName,
		(deviceModel as { model?: string })?.model ?? order.model,
		order.color,
	)
	const imeiDisplay = String(order.imei || '').trim() || '—'
	const locationDisplay = String(order.device_location || '').trim()
	const passParts = buildPasscodeSummaryParts(order)

	if (!useCollapsible) {
		return (
			<Card>
				<CardContent className="space-y-6 p-5">
					<DeviceFormFields {...props} />
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="relative">
			<div
				className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/80"
				role="toolbar"
				aria-label="Ações do aparelho"
			>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={() => setEditing((v) => !v)}
					aria-label={
						editing ? 'Recolher informações do aparelho' : 'Editar informações do aparelho'
					}
				>
					{editing ? (
						<ChevronUp className="h-3.5 w-3.5" aria-hidden />
					) : (
						<Pencil className="h-3.5 w-3.5" aria-hidden />
					)}
				</Button>
			</div>
			<CardContent className="flex flex-col gap-6 p-5 pt-5 pr-12">
				<div
					className={cn(
						'flex flex-col gap-4',
						editing && 'hidden',
					)}
				>
					<div className="grid min-w-0 grid-cols-3 gap-3 text-sm">
						<div className="min-w-0 space-y-1">
							<div className="text-muted-foreground">Aparelho</div>
							<div className="font-medium text-foreground break-words">
								{aparelhoLine}
							</div>
						</div>
						<div className="min-w-0 space-y-1">
							<div className="text-muted-foreground">{passParts.label}</div>
							<div className="font-medium text-foreground break-all">
								{passParts.value}
							</div>
						</div>
						<div className="min-w-0 space-y-1">
							<div className="text-muted-foreground">IMEI/Série</div>
							<div className="font-medium text-foreground break-all">
								{imeiDisplay}
							</div>
						</div>
					</div>
					{locationDisplay ? (
						<div className="min-w-0 space-y-1 text-sm">
							<div className="text-muted-foreground">Localização do aparelho</div>
							<div className="font-medium text-foreground break-words whitespace-pre-wrap">
								{locationDisplay}
							</div>
						</div>
					) : null}
				</div>

				<div className={cn(!editing && 'hidden')}>
					<DeviceFormFields {...props} />
				</div>
			</CardContent>
		</Card>
	)
}
