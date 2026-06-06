'use client'

import Link from 'next/link'
import { MoreHorizontal, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateBr } from '@/lib/utils/format-date'
import { maskedFromCents } from '@/lib/utils/money'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { DeviceBadges } from './DeviceBadges'

type CostRow = { value_cents?: number }

export type SeminovoDeviceCardDevice = {
	id: string
	device_name: string | null
	storage_gb: string | null
	color: string | null
	battery: string | null
	condition: string | null
	info: string | null
	imei: string | null
	purchase_value_cents: number | null
	wholesale_value_cents: number | null
	sale_value_cents: number | null
	sold_for_cents: number | null
	purchase_date: string | null
	sale_date: string | null
	sold?: boolean
	costs?: CostRow[]
	buyer_name?: string | null
	buyer_cpf?: string | null
	sale_details?: string | null
	display_image_url?: string | null
	stock_type?: string | null
}

function centsToReais(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return ''
	return maskedFromCents(cents)
}

type SeminovoDeviceCardProps = {
	device: SeminovoDeviceCardDevice
	variant: 'available' | 'sold'
	canViewPurchaseValue: boolean
	showPurchaseValue: boolean
	showWholesaleValue: boolean
	renderMenu: (device: SeminovoDeviceCardDevice) => React.ReactNode
}

export function SeminovoDeviceCard({
	device: d,
	variant,
	canViewPurchaseValue,
	showPurchaseValue,
	showWholesaleValue,
	renderMenu,
}: SeminovoDeviceCardProps) {
	const totalCostsCents = (d.costs || []).reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
	const isNovo = d.stock_type === 'lacrado'
	const aparelhoTitle = [
		d.device_name,
		d.storage_gb,
		d.color,
		...(isNovo ? [] : [d.battery, d.condition]),
	].filter(Boolean).join(' | ')
	const isSold = variant === 'sold' || Boolean(d.sold)
	const displayUrl = d.display_image_url
	const imgOk = Boolean(displayUrl?.trim())
	const showListingPhoto = !isSold && imgOk

	const cardClassName = variant === 'sold'
		? 'group relative rounded-lg border bg-card overflow-hidden bg-muted/30 transition-shadow duration-200 hover:shadow-md hover:border-primary/25'
		: `group relative rounded-lg border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-md hover:border-primary/30 ${d.sold ? 'opacity-75' : ''}`

	return (
		<div className={cardClassName}>
			<Link
				href={revendaPath.device(d.id)}
				className="absolute inset-0 z-0"
				aria-label={`Abrir aparelho ${aparelhoTitle || d.device_name || d.id}`}
			/>
			<div className="relative z-10 flex flex-col pointer-events-none [&_button]:pointer-events-auto">
				{!isSold ? (
					<div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted">
						{showListingPhoto ? (
							<img
								src={displayUrl!}
								alt=""
								className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center text-muted-foreground">
								<Smartphone className="h-14 w-14 opacity-35" aria-hidden />
							</div>
						)}
					</div>
				) : null}
				<div className="p-4">
					<div className="flex items-start justify-between gap-1.5 mb-2">
						<div className="min-w-0">
							<DeviceBadges
								deviceName={d.device_name}
								storageGb={d.storage_gb}
								color={d.color}
								battery={d.battery}
								condition={d.condition}
								imei={d.imei}
								omitBatteryCondition={isNovo}
							/>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Ações">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{renderMenu(d)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="space-y-1.5 text-sm">
						{d.info ? (
							<div>
								<span className="text-muted-foreground text-xs block mb-0.5">Info</span>
								<p className="text-xs line-clamp-2 text-muted-foreground">{d.info}</p>
							</div>
						) : null}
						<div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-border/60">
							{canViewPurchaseValue ? (
								<div>
									<span className="text-muted-foreground text-xs">Compra</span>
									<p className="font-medium">
										{showPurchaseValue && d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '—'}
									</p>
								</div>
							) : null}
							<div>
								<span className="text-muted-foreground text-xs">Custos</span>
								<p className="font-medium">{totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '—'}</p>
							</div>
							{variant === 'available' ? (
								<>
									<div>
										<span className="text-muted-foreground text-xs">Varejo</span>
										<p className="font-medium">{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '—'}</p>
									</div>
									<div>
										<span className="text-muted-foreground text-xs">Atacado</span>
										<p className="font-medium">{showWholesaleValue && d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '—'}</p>
									</div>
									<div className="col-span-2">
										<span className="text-muted-foreground text-xs">Data compra</span>
										<p className="font-medium">{d.purchase_date ? formatDateBr(d.purchase_date) : '—'}</p>
									</div>
								</>
							) : (
								<>
									<div>
										<span className="text-muted-foreground text-xs">Vendido</span>
										<p className="font-medium">{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '—'}</p>
									</div>
									<div>
										<span className="text-muted-foreground text-xs">Data venda</span>
										<p className="font-medium">{d.sale_date ? formatDateBr(d.sale_date) : '—'}</p>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
