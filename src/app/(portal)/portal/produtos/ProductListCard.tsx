'use client'

import { memo, useCallback } from 'react'
import { Copy, CopyPlus, Loader2, MoreHorizontal, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
	productListShowsStock,
	productTableCheckboxClass,
	productTableCheckboxColumnClass,
	productTableCheckboxColumnWidthPx,
	type ProductRow,
} from './product-list-shared'
import { ProductListBarcodeCell, type ProductBarcodeJob } from './ProductListBarcodeCell'
import { ProductListNameImageBlock } from './ProductListNameImageBlock'
import {
	cancelProductFormPrefetch,
	prefetchProductForm,
	scheduleProductFormPrefetch,
} from './product-form-cache'
import { QuickCostPriceCell } from './QuickCostPriceCell'
import { QuickSalePriceCell } from './QuickSalePriceCell'

type Props = {
	product: ProductRow
	isSelected: boolean
	isProductTab: boolean
	bulkBusy: boolean
	blingHubConnected?: boolean
	isSyncing: boolean
	isDuplicating: boolean
	barcodeJob: ProductBarcodeJob | null
	onToggleSelect: (id: string, checked: boolean, shiftKey?: boolean) => void
	onRowClick: (product: ProductRow) => void
	onOpenStock: (product: ProductRow) => void
	onGenerateBarcode: (id: string) => void
	onSyncFromBling: (id: string) => void
	onDuplicate: (product: ProductRow) => void
	onDelete: (product: ProductRow) => void
	onEditProduct: (product: ProductRow) => void
	onPrintLabel: (product: ProductRow) => void
}

export const ProductListCard = memo(function ProductListCard({
	product,
	isSelected,
	isProductTab,
	bulkBusy,
	blingHubConnected = false,
	isSyncing,
	isDuplicating,
	barcodeJob,
	onToggleSelect,
	onRowClick,
	onOpenStock,
	onGenerateBarcode,
	onSyncFromBling,
	onDuplicate,
	onDelete,
	onEditProduct,
	onPrintLabel,
}: Props) {
	const handleCheckboxChange = useCallback(
		(checked: boolean) => {
			onToggleSelect(product.id, checked)
		},
		[onToggleSelect, product.id]
	)

	const handleCardClick = useCallback((event?: React.MouseEvent) => {
		if (event?.shiftKey) {
			event.preventDefault()
			return
		}
		onRowClick(product)
	}, [onRowClick, product])

	const copyToClipboard = useCallback((text: string) => {
		const t = String(text || '').trim()
		if (!t) return
		const write = navigator?.clipboard?.writeText(t)
		if (!write) {
			toast({
				variant: 'destructive',
				title: 'Não foi possível copiar',
				description: 'Área de transferência indisponível neste navegador.',
			})
			return
		}
		void write
			.then(() => {
				toast({ description: 'Copiado para a área de transferência', duration: 2000 })
			})
			.catch(() => {
				toast({
					variant: 'destructive',
					title: 'Não foi possível copiar',
					description: 'Verifique permissões do site ou use HTTPS.',
				})
			})
	}, [])

	const serverBarcode = product.barcode?.trim() || null
	const barcodeBlock = (
		<ProductListBarcodeCell
			serverBarcode={serverBarcode}
			job={barcodeJob}
			onGenerate={() => onGenerateBarcode(product.id)}
			onCopy={copyToClipboard}
			textClassName="text-xs"
		/>
	)

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleCardClick}
			onPointerEnter={() => scheduleProductFormPrefetch(product.id)}
			onPointerLeave={() => cancelProductFormPrefetch(product.id)}
			onPointerDown={(event) => {
				if (event.shiftKey && event.button === 0) {
					event.preventDefault()
					if (!bulkBusy) onToggleSelect(product.id, true, true)
					return
				}
				prefetchProductForm(product.id)
			}}
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
					className={cn('flex items-center justify-center', productTableCheckboxColumnClass)}
					style={{
						width: productTableCheckboxColumnWidthPx,
						minWidth: productTableCheckboxColumnWidthPx,
						maxWidth: productTableCheckboxColumnWidthPx,
						boxSizing: 'border-box',
					}}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<Checkbox
						className={productTableCheckboxClass}
						checked={isSelected}
						onPointerDown={(event) => {
							if (!event.shiftKey || event.button !== 0) return
							event.preventDefault()
							event.stopPropagation()
							onToggleSelect(product.id, true, true)
						}}
						onClick={(event) => {
							if (!event.shiftKey) return
							event.preventDefault()
						}}
						onCheckedChange={(c) => handleCheckboxChange(c === true)}
						aria-label={`Selecionar ${product.name}`}
						disabled={bulkBusy}
					/>
				</div>
				<div className="min-w-0 flex-1 space-y-3">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<ProductListNameImageBlock
								product={product}
								blingHubConnected={blingHubConnected}
							/>
						</div>
						<div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-9 w-9 shrink-0"
										onPointerDown={() => prefetchProductForm(product.id)}
									>
										<MoreHorizontal className="h-4 w-4" />
										<span className="sr-only">Abrir ações</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={(event) => {
											event.preventDefault()
											onEditProduct(product)
										}}
									>
										Editar
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={(event) => {
											event.preventDefault()
											onDuplicate(product)
										}}
										disabled={isDuplicating}
									>
										{isDuplicating
											? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Duplicando...
												</>
											)
											: (
												<>
													<CopyPlus className="mr-2 h-4 w-4" />
													Duplicar
												</>
											)}
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={(event) => {
											event.preventDefault()
											onPrintLabel(product)
										}}
									>
										<Tag className="mr-2 h-4 w-4" />
										Imprimir etiqueta
									</DropdownMenuItem>
									{blingHubConnected && product.bling_id && (
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
							<div className="min-w-0" onPointerDown={(e) => e.stopPropagation()}>
								<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Código de barras</dt>
								<dd className="mt-0.5 min-w-0">{barcodeBlock}</dd>
							</div>
							{isProductTab && (
								<div className="min-w-0">
									<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estoque</dt>
									<dd className="mt-0.5">
										{productListShowsStock(product)
											? (
												<button
													type="button"
													className="rounded px-1 -mx-1 tabular-nums text-primary underline-offset-4 hover:underline"
													onClick={(e) => {
														e.stopPropagation()
														onOpenStock(product)
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
									? 'grid grid-cols-2 gap-x-3 gap-y-1'
									: 'grid grid-cols-1 gap-x-3 gap-y-1'
							}
						>
							{isProductTab && (
								<div className="min-w-0">
									<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Custo</dt>
									<dd className="mt-0.5 min-w-0" onClick={(e) => e.stopPropagation()}>
										<QuickCostPriceCell
											align="left"
											productId={product.id}
											blingId={product.bling_id}
											costPriceCents={product.cost_price_cents}
										/>
									</dd>
								</div>
							)}
							<div className="min-w-0">
								<dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preço venda</dt>
								<dd className="mt-0.5 min-w-0" onClick={(e) => e.stopPropagation()}>
									<QuickSalePriceCell
										align="left"
										productId={product.id}
										blingId={product.bling_id}
										blingHubConnected={blingHubConnected}
										salePriceCents={product.sale_price_cents}
									/>
								</dd>
							</div>
						</div>
					</dl>
				</div>
			</div>
		</div>
	)
})
