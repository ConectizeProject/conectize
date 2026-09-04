'use client'

import {
	Barcode,
	ClipboardList,
	Clock,
	FileText,
	Package,
	ShoppingCart,
	Sparkles,
	Tag,
	Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import type { MeliFlexAggregateStatus } from '@/lib/integrations/mercado-livre/listing-display'
import {
	formatMeliRelativeDate,
	type MeliListingMetadata,
} from '@/lib/integrations/mercado-livre/listing-metadata'
import { cn } from '@/lib/utils'
import { maskedFromCents } from '@/lib/utils/money'
import { MeliCopyButton } from './meli-listing-copy'

function MeliFlexIcon({
	status,
	grouped = false,
	className,
}: {
	status: MeliFlexAggregateStatus
	grouped?: boolean
	className?: string
}) {
	const colorClass =
		status === 'active'
			? 'text-emerald-600'
			: status === 'mixed'
				? 'text-amber-500'
				: 'text-muted-foreground/55'

	const label =
		status === 'active'
			? grouped
				? 'Flex ativado em todas as variações'
				: 'Flex ativado'
			: status === 'mixed'
				? 'Flex ativado em parte das variações'
				: status === 'inactive'
					? 'Flex desativado'
					: 'Sem Flex'

	return (
		<span
			title={label}
			aria-label={label}
			className={cn('inline-flex shrink-0 items-center', colorClass, className)}
		>
			<Zap className="h-3.5 w-3.5 fill-current" aria-hidden />
		</span>
	)
}

function StatChip({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Package
	label: string
	value: string
}) {
	return (
		<span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
			<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
			<span className="font-medium text-foreground tabular-nums">{value}</span>
			<span>{label}</span>
		</span>
	)
}

function InsightChip({
	children,
	onClick,
	disabled,
	title,
	className,
}: {
	children: ReactNode
	onClick?: () => void
	disabled?: boolean
	title?: string
	className?: string
}) {
	if (onClick) {
		return (
			<Button
				type="button"
				variant="outline"
				size="sm"
				title={title}
				disabled={disabled}
				onClick={onClick}
				className={cn(
					'h-7 gap-1 rounded-md px-2 text-[11px] font-medium',
					className,
				)}
			>
				{children}
			</Button>
		)
	}
	return (
		<span
			title={title}
			className={cn(
				'inline-flex h-7 items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 text-[11px] font-medium text-foreground',
				className,
			)}
		>
			{children}
		</span>
	)
}

function totalAvailable(params: {
	availableQuantity: number | null
	stockFull: number | null
	stockDeposito: number | null
}): number | null {
	if (params.stockFull != null || params.stockDeposito != null) {
		return (params.stockFull ?? 0) + (params.stockDeposito ?? 0)
	}
	return params.availableQuantity
}

export type MeliListingInsightsProps = {
	title: string
	availableQuantity: number | null
	stockFull: number | null
	stockDeposito: number | null
	soldQuantity: number | null
	flexStatus: MeliFlexAggregateStatus
	groupedFlex?: boolean
	barcode: string | null
	meta: MeliListingMetadata
}

export function MeliListingInsights({
	title,
	availableQuantity,
	stockFull,
	stockDeposito,
	soldQuantity,
	flexStatus,
	groupedFlex = false,
	barcode,
	meta,
}: MeliListingInsightsProps) {
	const [descriptionOpen, setDescriptionOpen] = useState(false)
	const [wholesaleOpen, setWholesaleOpen] = useState(false)
	const [specsOpen, setSpecsOpen] = useState(false)

	const available = totalAvailable({
		availableQuantity,
		stockFull,
		stockDeposito,
	})
	const promotions = meta.promotions_count ?? 0
	const createdLabel = formatMeliRelativeDate(meta.date_created) ?? '—'
	const updatedLabel = formatMeliRelativeDate(meta.last_updated) ?? '—'
	const hasDescription = Boolean(meta.description_plain?.trim())
	const hasWholesale = meta.wholesale_tiers.length > 0
	const hasSpecs = meta.technical_specs.length > 0

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-1.5">
				<StatChip
					icon={Package}
					label="Disponível"
					value={String(available ?? '—')}
				/>
				{stockFull != null ? (
					<StatChip icon={Package} label="Full" value={String(stockFull)} />
				) : null}
				{stockDeposito != null && (stockFull == null || stockDeposito > 0) ? (
					<StatChip
						icon={Package}
						label="Depósito"
						value={String(stockDeposito)}
					/>
				) : null}
				<StatChip
					icon={ShoppingCart}
					label="Vendidos"
					value={String(soldQuantity ?? 0)}
				/>
				<StatChip icon={Tag} label="Promoções" value={String(promotions)} />
				<StatChip icon={Sparkles} label="Criação" value={createdLabel} />
				<StatChip icon={Clock} label="Edição" value={updatedLabel} />
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<InsightChip
					title="Descrição do anúncio"
					disabled={!hasDescription}
					onClick={hasDescription ? () => setDescriptionOpen(true) : undefined}
				>
					<FileText className="h-3.5 w-3.5" aria-hidden />
					Descrição
				</InsightChip>

				<InsightChip title="Mercado Envios Flex">
					<MeliFlexIcon status={flexStatus} grouped={groupedFlex} />
					Flex
				</InsightChip>

				{barcode ? (
					<InsightChip title="Código de barras">
						<Barcode className="h-3.5 w-3.5" aria-hidden />
						<MeliCopyButton
							value={barcode}
							display="Cód. barras"
							ariaLabel={`Copiar código de barras ${barcode}`}
							className="border-0 bg-transparent p-0 hover:bg-transparent"
						/>
					</InsightChip>
				) : null}

				<InsightChip
					title="Preço atacado por quantidade"
					disabled={!hasWholesale}
					onClick={hasWholesale ? () => setWholesaleOpen(true) : undefined}
				>
					<ShoppingCart className="h-3.5 w-3.5" aria-hidden />
					Preço atacado
				</InsightChip>

				<InsightChip
					title="Ficha técnica"
					disabled={!hasSpecs}
					onClick={hasSpecs ? () => setSpecsOpen(true) : undefined}
				>
					<ClipboardList className="h-3.5 w-3.5" aria-hidden />
					Ficha técnica
				</InsightChip>

				{meta.pictures_count != null && meta.pictures_count > 0 ? (
					<InsightChip title="Fotos do anúncio">
						<span className="tabular-nums">{meta.pictures_count}</span> fotos
					</InsightChip>
				) : null}

				{meta.free_shipping ? (
					<Badge
						variant="secondary"
						className="h-7 rounded-md px-2 text-[11px]"
					>
						Frete grátis
					</Badge>
				) : null}

				{meta.user_product_id ? (
					<InsightChip title="User Product ID">
						<MeliCopyButton
							value={meta.user_product_id}
							display={meta.user_product_id}
							ariaLabel={`Copiar user product ${meta.user_product_id}`}
							className="max-w-[140px] border-0 bg-transparent p-0 hover:bg-transparent"
						/>
					</InsightChip>
				) : null}
			</div>

			{meta.dimensions_label ? (
				<Badge
					variant="outline"
					className="rounded-md border-emerald-600/30 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
				>
					{meta.dimensions_label}
				</Badge>
			) : null}

			{meta.warranty ? (
				<p className="text-[11px] text-muted-foreground">
					Garantia: <span className="text-foreground">{meta.warranty}</span>
				</p>
			) : null}

			<Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
				<DialogContent className="max-h-[min(85vh,640px)] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Descrição</DialogTitle>
						<DialogDescription className="line-clamp-2">
							{title}
						</DialogDescription>
					</DialogHeader>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{meta.description_plain}
					</p>
				</DialogContent>
			</Dialog>

			<Dialog open={wholesaleOpen} onOpenChange={setWholesaleOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Preço atacado</DialogTitle>
						<DialogDescription>
							Quantidade mínima e preço por faixa
						</DialogDescription>
					</DialogHeader>
					<ul className="space-y-2">
						{meta.wholesale_tiers.map((tier) => (
							<li
								key={tier.min_quantity}
								className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
							>
								<span className="text-muted-foreground">
									{tier.min_quantity}+ un.
								</span>
								<span className="font-semibold tabular-nums">
									{maskedFromCents(tier.price_cents)}
								</span>
							</li>
						))}
					</ul>
				</DialogContent>
			</Dialog>

			<Dialog open={specsOpen} onOpenChange={setSpecsOpen}>
				<DialogContent className="max-h-[min(85vh,640px)] max-w-lg overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Ficha técnica</DialogTitle>
						<DialogDescription className="line-clamp-2">
							{title}
						</DialogDescription>
					</DialogHeader>
					<dl className="space-y-2">
						{meta.technical_specs.map((spec) => (
							<div
								key={`${spec.name}-${spec.value}`}
								className="grid grid-cols-[minmax(0,42%)_1fr] gap-2 rounded-md border px-3 py-2 text-sm"
							>
								<dt className="text-muted-foreground">{spec.name}</dt>
								<dd className="font-medium">{spec.value}</dd>
							</div>
						))}
					</dl>
				</DialogContent>
			</Dialog>
		</div>
	)
}
