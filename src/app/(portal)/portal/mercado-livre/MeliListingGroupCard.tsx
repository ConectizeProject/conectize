'use client'

import { ChevronDown, Package, Pencil, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { MeliFlexAggregateStatus } from '@/lib/integrations/mercado-livre/listing-display'
import { meliListingEditUrl } from '@/lib/integrations/mercado-livre/listing-urls'
import type {
	MeliListingChild,
	MeliListingGroup,
} from '@/lib/integrations/mercado-livre/listing-variations'
import { cn } from '@/lib/utils'
import { maskedFromCents } from '@/lib/utils/money'
import { MeliCopyButton, MeliIdCopyButton } from './meli-listing-copy'
import { MeliListingInsights } from './meli-listing-insights'
import {
	buildMeliMosaicCells,
	buildMeliMosaicGridSlots,
	type MeliMosaicGridSlot,
	meliMosaicUsesGrid,
} from './meli-listing-mosaic'

function isSafeImageUrl(url: string | null | undefined): boolean {
	if (!url) return false
	try {
		const u = new URL(url)
		return u.protocol === 'https:' || u.protocol === 'http:'
	} catch {
		return false
	}
}

function statusBadge(status: string) {
	const s = status.toLowerCase()
	if (s === 'active') {
		return {
			label: 'Ativo',
			className: 'bg-green-600 hover:bg-green-600 text-white',
		}
	}
	if (s === 'paused') {
		return {
			label: 'Pausado',
			className: 'bg-amber-500 hover:bg-amber-500 text-white',
		}
	}
	if (s === 'closed') {
		return { label: 'Encerrado', variant: 'secondary' as const }
	}
	return { label: status || '—', variant: 'outline' as const }
}

function MosaicImage({ url }: { url: string | null }) {
	if (isSafeImageUrl(url)) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={url || ''}
				alt=""
				loading="lazy"
				className="h-full w-full object-cover"
			/>
		)
	}
	return (
		<div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
			<ShoppingBag className="h-4 w-4 opacity-40" />
		</div>
	)
}

function MosaicGridSlotView({ slot }: { slot: MeliMosaicGridSlot }) {
	if (slot.kind === 'empty') {
		return <div className="aspect-square min-h-0 min-w-0" aria-hidden />
	}
	if (slot.kind === 'overflow') {
		return (
			<div className="flex aspect-square min-h-0 min-w-0 items-center justify-center rounded-sm border border-border/60 bg-background text-[11px] font-medium tabular-nums text-muted-foreground">
				+{slot.extra}
			</div>
		)
	}
	return (
		<div className="aspect-square min-h-0 min-w-0 overflow-hidden rounded-sm border border-border/60 bg-background">
			<MosaicImage url={slot.url} />
		</div>
	)
}

function GroupThumbMosaic({
	thumbs,
	className,
}: {
	thumbs: Array<string | null | undefined>
	className?: string
}) {
	const cells = buildMeliMosaicCells(thumbs)
	const useGrid = meliMosaicUsesGrid(thumbs.length)

	if (!useGrid) {
		const cell = cells[0]
		const url = cell?.kind === 'image' ? cell.url : null
		return (
			<div
				className={cn(
					'relative shrink-0 overflow-hidden rounded-md bg-muted',
					className,
				)}
			>
				{isSafeImageUrl(url) ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={url || ''}
						alt=""
						loading="lazy"
						className="h-full w-full object-contain p-1"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<ShoppingBag className="h-7 w-7 opacity-40" />
					</div>
				)}
			</div>
		)
	}

	const slots = buildMeliMosaicGridSlots(thumbs)

	return (
		<div
			className={cn(
				'relative grid shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-md bg-muted/50 p-1',
				className,
			)}
		>
			{slots.map((slot, index) => (
				<MosaicGridSlotView
					key={
						slot.kind === 'empty'
							? `empty-${index}`
							: slot.kind === 'overflow'
								? 'overflow'
								: `img-${index}`
					}
					slot={slot}
				/>
			))}
		</div>
	)
}

function ListingThumb({
	url,
	className,
}: {
	url: string | null
	className?: string
}) {
	return <GroupThumbMosaic thumbs={[url]} className={className} />
}

function ListingSkuField({ sku }: { sku: string | null }) {
	if (!sku) return null
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="inline-flex max-w-full min-w-0 items-center gap-1 text-[11px]">
				<span className="text-muted-foreground">SKU</span>
				<MeliCopyButton value={sku} ariaLabel={`Copiar SKU ${sku}`} />
			</span>
		</div>
	)
}

function StatusBadge({ status }: { status: string }) {
	const badge = statusBadge(status)
	if ('variant' in badge) {
		return <Badge variant={badge.variant}>{badge.label}</Badge>
	}
	return <Badge className={badge.className}>{badge.label}</Badge>
}

function PriceLabel({
	cents,
	originalCents,
	prefix,
}: {
	cents: number | null
	originalCents?: number | null
	prefix?: string
}) {
	if (cents == null) return null
	const hasPromo = originalCents != null && originalCents > cents

	return (
		<div className="text-right">
			{prefix ? (
				<p className="text-[10px] font-medium text-muted-foreground">
					{prefix}
				</p>
			) : null}
			{hasPromo ? (
				<>
					<p className="text-xs text-muted-foreground line-through tabular-nums">
						{maskedFromCents(originalCents)}
					</p>
					<p className="text-sm font-semibold tabular-nums text-foreground">
						{maskedFromCents(cents)}
					</p>
				</>
			) : (
				<p className="text-sm font-semibold tabular-nums">
					{maskedFromCents(cents)}
				</p>
			)}
		</div>
	)
}

function ListingMetaRow({
	mlItemId,
	sku,
	showSku,
}: {
	mlItemId: string | null
	sku: string | null
	showSku?: boolean
}) {
	return (
		<div className="space-y-1">
			<MeliIdCopyButton id={mlItemId} />
			{showSku ? <ListingSkuField sku={sku} /> : null}
		</div>
	)
}

function ListingInsightsPanel({
	title,
	listing,
	flexStatus,
	groupedFlex = false,
	barcode,
}: {
	title: string
	listing: {
		available_quantity: number | null
		stock_full: number | null
		stock_deposito: number | null
		sold_quantity: number | null
		meta: MeliListingChild['meta']
	}
	flexStatus: MeliFlexAggregateStatus
	groupedFlex?: boolean
	barcode: string | null
}) {
	return (
		<MeliListingInsights
			title={title}
			availableQuantity={listing.available_quantity}
			stockFull={listing.stock_full}
			stockDeposito={listing.stock_deposito}
			soldQuantity={listing.sold_quantity}
			flexStatus={flexStatus}
			groupedFlex={groupedFlex}
			barcode={barcode}
			meta={listing.meta}
		/>
	)
}

function groupPricePrefix(group: MeliListingGroup): string | undefined {
	if (group.children.length < 2) return undefined
	const prices = group.children
		.map((child) => child.price_cents)
		.filter((value): value is number => value != null)
	if (prices.length < 2) return undefined
	const min = Math.min(...prices)
	const max = Math.max(...prices)
	return min !== max ? 'A partir de' : undefined
}

function childMatchesQuery(child: MeliListingChild, query: string): boolean {
	const q = query.trim().toLowerCase()
	if (!q) return false
	return [child.title, child.ml_item_id, child.seller_sku, child.barcode]
		.map((value) => String(value || '').toLowerCase())
		.some((value) => value.includes(q))
}

export function shouldAutoExpandMeliGroup(
	group: MeliListingGroup,
	query: string,
): boolean {
	const q = query.trim().toLowerCase()
	if (!q || group.children.length === 0) return false
	const parentHit = [group.listing.title, group.listing.ml_item_id]
		.join(' ')
		.toLowerCase()
		.includes(q)
	if (parentHit) return false
	return group.children.some((child) => childMatchesQuery(child, query))
}

function ListingTitleLink({
	title,
	permalink,
	className,
}: {
	title: string
	permalink: string | null
	className?: string
}) {
	const baseClass = cn(
		'line-clamp-1 font-medium leading-snug transition-colors',
		className,
	)
	if (!permalink) {
		return <p className={baseClass}>{title}</p>
	}
	return (
		<a
			href={permalink}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				baseClass,
				'text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			)}
			title="Abrir no Mercado Livre"
		>
			{title}
		</a>
	)
}

function ListingActions({
	productId,
	mlItemId,
}: {
	productId: string | null
	mlItemId: string | null
}) {
	const editUrl = meliListingEditUrl(mlItemId)
	if (!editUrl && !productId) return null
	return (
		<div className="flex flex-wrap gap-1.5">
			{editUrl ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 gap-1 text-xs"
					asChild
				>
					<a href={editUrl} target="_blank" rel="noopener noreferrer">
						<Pencil className="h-3 w-3" />
						Editar no ML
					</a>
				</Button>
			) : null}
			{productId ? (
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="h-7 gap-1 text-xs"
					asChild
				>
					<Link href={`/portal/produtos?edit=${productId}`}>
						<Package className="h-3 w-3" />
						Produto
					</Link>
				</Button>
			) : null}
		</div>
	)
}

function VariationRow({
	child,
	highlighted,
}: {
	child: MeliListingChild
	highlighted: boolean
}) {
	return (
		<li
			className={cn(
				'flex items-start gap-3 rounded-md border bg-background px-3 py-2.5',
				highlighted && 'ring-1 ring-primary/40',
			)}
		>
			<ListingThumb url={child.thumbnail_url} className="h-14 w-14" />
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1 space-y-1">
						<ListingTitleLink
							title={child.title}
							permalink={child.permalink}
							className="text-sm"
						/>
						<ListingMetaRow
							mlItemId={child.ml_item_id}
							sku={child.seller_sku}
							showSku
						/>
						<ListingInsightsPanel
							title={child.title}
							listing={child}
							flexStatus={child.flex_status}
							barcode={child.barcode}
						/>
						<ListingActions
							productId={child.product_id}
							mlItemId={child.ml_item_id}
						/>
					</div>
					<div className="shrink-0 space-y-1 text-right">
						<PriceLabel
							cents={child.price_cents}
							originalCents={child.original_price_cents}
						/>
						{child.status ? <StatusBadge status={child.status} /> : null}
					</div>
				</div>
			</div>
		</li>
	)
}

function groupMosaicThumbs(group: MeliListingGroup): Array<string | null> {
	if (group.children.length >= 2) {
		return group.children.map((child) => child.thumbnail_url)
	}
	return [group.listing.thumbnail_url]
}

export function MeliListingGroupCard({
	group,
	query,
}: {
	group: MeliListingGroup
	query: string
}) {
	const listing = group.listing
	const hasChildren = group.children.length >= 2
	const panelId = useId()
	const autoExpand = shouldAutoExpandMeliGroup(group, query)
	const [open, setOpen] = useState(autoExpand)

	useEffect(() => {
		if (autoExpand) setOpen(true)
	}, [autoExpand])

	return (
		<Card className="overflow-hidden">
			<CardContent className="p-3 sm:p-4">
				<div className="flex items-start gap-3">
					{hasChildren ? (
						<button
							type="button"
							className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-primary/10 text-primary transition-colors hover:bg-primary/15"
							aria-expanded={open}
							aria-controls={panelId}
							onClick={() => setOpen((current) => !current)}
						>
							<ChevronDown
								className={cn(
									'h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
									open && 'rotate-180',
								)}
							/>
							<span className="sr-only">
								{open ? 'Recolher variações' : 'Expandir variações'}
							</span>
						</button>
					) : null}

					<GroupThumbMosaic
						thumbs={groupMosaicThumbs(group)}
						className="h-20 w-20 sm:h-24 sm:w-24"
					/>

					<div className="min-w-0 flex-1 space-y-1.5">
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0 flex-1 space-y-1">
								<ListingTitleLink
									title={listing.title}
									permalink={listing.permalink}
									className="text-sm"
								/>
								<ListingMetaRow
									mlItemId={listing.ml_item_id}
									sku={listing.seller_sku}
									showSku={!hasChildren}
								/>
								<ListingInsightsPanel
									title={listing.title}
									listing={listing}
									flexStatus={listing.flex_aggregate_status}
									groupedFlex={hasChildren}
									barcode={listing.barcode}
								/>
							</div>
							<div className="shrink-0 space-y-1 text-right">
								<PriceLabel
									cents={listing.price_cents}
									originalCents={listing.original_price_cents}
									prefix={groupPricePrefix(group)}
								/>
								<StatusBadge status={listing.status} />
							</div>
						</div>
						<ListingActions
							productId={listing.product_id}
							mlItemId={hasChildren ? null : listing.ml_item_id}
						/>
					</div>
				</div>

				{hasChildren ? (
					<div
						id={panelId}
						className={cn(
							'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
							open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
						)}
					>
						<div className="overflow-hidden">
							<ul className="mt-3 space-y-2 border-l-2 border-primary/20 pl-3 sm:ml-11">
								{group.children.map((child) => (
									<VariationRow
										key={child.key}
										child={child}
										highlighted={childMatchesQuery(child, query)}
									/>
								))}
							</ul>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
