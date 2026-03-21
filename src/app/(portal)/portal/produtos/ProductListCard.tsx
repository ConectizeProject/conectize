'use client'

import Link from 'next/link'
import { memo, useCallback } from 'react'
import { Barcode, Copy, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { productTableCheckboxClass, type ProductRow } from './product-list-shared'
import { ProductListNameImageBlock } from './ProductListNameImageBlock'
import { QuickSalePriceCell } from './QuickSalePriceCell'

type Props = {
	product: ProductRow
	isSelected: boolean
	isProductTab: boolean
	bulkBusy: boolean
	isSyncing: boolean
	isBarcodeGenerating: boolean
	barcodeGeneratingStage: 'updating' | 'syncing' | null
	optimisticBarcode: string | null
	onToggleSelect: (id: string, checked: boolean) => void
	onRowClick: (product: ProductRow) => void
	onOpenStock: (payload: {
		id: string
		name: string
		costPriceCents?: number | null
		currentStock: number
	}) => void
	onGenerateBarcode: (id: string) => void
	onSyncFromBling: (id: string) => void
	onDelete: (product: ProductRow) => void
}

export const ProductListCard = memo(function ProductListCard ({
	product,
	isSelected,
	isProductTab,
	bulkBusy,
	isSyncing,
	isBarcodeGenerating,
	barcodeGeneratingStage,
	optimisticBarcode,
	onToggleSelect,
	onRowClick,
	onOpenStock,
	onGenerateBarcode,
	onSyncFromBling,
	onDelete,
}: Props) {
	const handleCheckboxChange = useCallback(
		(checked: boolean) => {
			onToggleSelect(product.id, checked)
		},
		[onToggleSelect, product.id]
	)

	const handleCardClick = useCallback(() => {
		onRowClick(product)
	}, [onRowClick, product])

	const copyToClipboard = useCallback((text: string) => {
		navigator?.clipboard?.writeText(text).then(() => {
			toast({ description: 'Copiado para a área de transferência', duration: 2000 })
		}).catch(() => {})
	}, [])

	const serverBarcode = product.barcode?.trim() || null
	const displayBarcode = serverBarcode || optimisticBarcode

	const barcodeBlock = (() => {
		if (displayBarcode && !isBarcodeGenerating) {
			return (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						copyToClipboard(displayBarcode)
					}}
					className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono text-xs transition-colors hover:bg-muted"
					title="Clique para copiar"
				>
					<span className="truncate">{displayBarcode}</span>
					<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
				</button>
			)
		}
		if (!product.bling_id) {
			return <span className="text-muted-foreground">—</span>
		}
		if (isBarcodeGenerating) {
			return (
				<div
					className="inline-flex max-w-full min-w-0 items-center gap-2 rounded border border-border/60 bg-muted/70 px-2 py-1"
					aria-busy="true"
				>
					<span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums">
						{displayBarcode
							? displayBarcode
							: (
								<span
									className="inline-block h-4 w-[7.5rem] max-w-full rounded bg-muted-foreground/15 animate-pulse"
									aria-hidden
								/>
							)}
					</span>
					<Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
				</div>
			)
		}
		return (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onGenerateBarcode(product.id)
				}}
				className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono text-xs transition-colors hover:bg-muted"
				aria-label="Gerar código de barras"
			>
				<Barcode className="h-3 w-3 text-muted-foreground" />
				<span className="truncate">Gerar</span>
			</button>
		)
	})()

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleCardClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					handleCardClick()
				}
			}}
			className="rounded-xl border border-border/80 bg-card p-3 text-sm shadow-sm outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex items-center gap-2">
				<div
					className="shrink-0"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<Checkbox
						className={productTableCheckboxClass}
						checked={isSelected}
						onCheckedChange={(c) => handleCheckboxChange(c === true)}
						aria-label={`Selecionar ${product.name}`}
						disabled={bulkBusy}
					/>
				</div>
				<div className="min-w-0 flex-1 space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<ProductListNameImageBlock product={product} />
						</div>
						<div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
										<MoreHorizontal className="h-4 w-4" />
										<span className="sr-only">Abrir ações</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem asChild>
										<Link href={`/portal/produtos/${product.id}/editar`}>Editar</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link href={`/portal/produtos/${product.id}`}>Ver detalhes</Link>
									</DropdownMenuItem>
									{product.bling_id && (
										<DropdownMenuItem
											onClick={() => onSyncFromBling(product.id)}
											disabled={isSyncing}
										>
											{isSyncing ? 'Sincronizando...' : 'Atualizar pelo Bling'}
										</DropdownMenuItem>
									)}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onSelect={(event) => {
											event.preventDefault()
											onDelete(product)
										}}
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Excluir
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<dl className="space-y-3 text-xs">
						<div className="min-w-0">
							<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">SKU</dt>
							<dd className="mt-0.5 min-w-0">
								{product.sku
									? (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												copyToClipboard(product.sku ?? '')
											}}
											className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-xs"
										>
											<span className="truncate">{product.sku}</span>
											<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
										</button>
									)
									: <span className="text-muted-foreground">—</span>}
							</dd>
						</div>

						<div
							className={
								isProductTab
									? 'grid grid-cols-2 gap-x-3 gap-y-1'
									: 'grid grid-cols-1'
							}
						>
							<div className="min-w-0">
								<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Código de barras</dt>
								<dd className="mt-0.5 min-w-0">{barcodeBlock}</dd>
							</div>
							{isProductTab && (
								<div className="min-w-0">
									<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estoque</dt>
									<dd className="mt-0.5">
										{product.has_stock_movements
											? (
												<button
													type="button"
													className="rounded px-1 -mx-1 tabular-nums text-primary underline-offset-4 hover:underline"
													onClick={(e) => {
														e.stopPropagation()
														onOpenStock({
															id: product.id,
															name: product.name,
															costPriceCents: product.cost_price_cents,
															currentStock: typeof product.current_stock === 'number' ? product.current_stock : 0,
														})
													}}
												>
													{typeof product.current_stock === 'number' ? product.current_stock : 0}
												</button>
											)
											: (
												<span className="tabular-nums text-muted-foreground">—</span>
											)}
									</dd>
								</div>
							)}
						</div>

						<div
							className={
								isProductTab
									? 'grid grid-cols-3 gap-x-2 gap-y-1'
									: 'grid grid-cols-2 gap-x-3 gap-y-1'
							}
						>
							<div className="min-w-0">
								<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preço venda</dt>
								<dd className="mt-0.5 min-w-0" onClick={(e) => e.stopPropagation()}>
									<QuickSalePriceCell
										align="left"
										productId={product.id}
										blingId={product.bling_id}
										salePriceCents={product.sale_price_cents}
									/>
								</dd>
							</div>
							{isProductTab && (
								<div className="min-w-0">
									<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Custo</dt>
									<dd className="mt-0.5 tabular-nums">
										{typeof product.cost_price_cents === 'number'
											? formatCurrency(product.cost_price_cents / 100)
											: '—'}
									</dd>
								</div>
							)}
							<div className="min-w-0">
								<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Origem</dt>
								<dd className="mt-0.5">
									{product.bling_id
										? (
											<div className="flex flex-wrap gap-1">
												<span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-blue-600 dark:text-blue-400">
													Bling
												</span>
												{product.bling_sync_pending && (
													<span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-amber-600 dark:text-amber-400">
														Pendente
													</span>
												)}
											</div>
										)
										: (
											<span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
												Manual
											</span>
										)}
								</dd>
							</div>
						</div>
					</dl>
				</div>
			</div>
		</div>
	)
})
