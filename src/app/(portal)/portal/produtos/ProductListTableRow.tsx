'use client'

import { memo, useCallback } from 'react'
import { Barcode, Copy, Loader2, MoreHorizontal, PencilLine, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import {
	getProductTableCheckboxColumnStyle,
	productTableCheckboxClass,
	productTableCheckboxColumnClass,
	type ProductRow,
} from './product-list-shared'
import { ProductListNameImageBlock } from './ProductListNameImageBlock'
import { QuickCostPriceCell } from './QuickCostPriceCell'
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
	onOpenStock: (product: ProductRow) => void
	onGenerateBarcode: (id: string) => void
	onSyncFromBling: (id: string) => void
	onDelete: (product: ProductRow) => void
	onEditProduct: (product: ProductRow) => void
	onPrintLabel: (product: ProductRow) => void
}

export const ProductListTableRow = memo(function ProductListTableRow ({
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
	onEditProduct,
	onPrintLabel,
}: Props) {
	const handleCheckboxChange = useCallback(
		(checked: boolean) => {
			onToggleSelect(product.id, checked)
		},
		[onToggleSelect, product.id]
	)

	const handleRowClick = useCallback(() => {
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
	const displayBarcode = serverBarcode || optimisticBarcode

	return (
		<tr
			className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
			onClick={handleRowClick}
		>
			<td
				className={productTableCheckboxColumnClass}
				style={getProductTableCheckboxColumnStyle('body')}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex min-h-[2.75rem] w-full max-w-full min-w-0 items-center justify-center py-2">
					<Checkbox
						className={productTableCheckboxClass}
						checked={isSelected}
						onCheckedChange={(c) => handleCheckboxChange(c === true)}
						aria-label={`Selecionar ${product.name}`}
						disabled={bulkBusy}
					/>
				</div>
			</td>
			<td className="min-w-0 py-2 pr-2 align-top">
				<ProductListNameImageBlock product={product} nameTruncate />
			</td>
			<td className="min-w-0 px-2 py-2 align-top">
				{product.sku
					? (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								copyToClipboard(product.sku ?? '')
							}}
							className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono transition-colors hover:bg-muted"
							title="Clique para copiar"
						>
							<span className="truncate">{product.sku}</span>
							<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
						</button>
					)
					: '—'}
			</td>
			<td className="min-w-0 px-2 py-2 align-top">
				{(() => {
					if (displayBarcode && !isBarcodeGenerating) {
						return (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									copyToClipboard(displayBarcode)
								}}
								className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono transition-colors hover:bg-muted"
								title="Clique para copiar"
							>
								<span className="truncate">{displayBarcode}</span>
								<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
							</button>
						)
					}

					if (!product.bling_id) {
						return '—'
					}

					if (isBarcodeGenerating) {
						return (
							<div
								className="inline-flex max-w-full min-w-0 items-center gap-2 rounded border border-border/60 bg-muted/70 px-2 py-1"
								aria-busy="true"
								title={
									barcodeGeneratingStage === 'syncing'
										? 'Sincronizando com o Bling…'
										: 'Gerando código de barras…'
								}
							>
								<span className="min-w-0 flex-1 truncate font-mono text-sm tabular-nums">
									{displayBarcode
										? displayBarcode
										: (
											<span
												className="inline-block h-4 w-[7.5rem] max-w-full rounded bg-muted-foreground/15 animate-pulse"
												aria-hidden
											/>
										)}
								</span>
								<Loader2
									className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
									aria-hidden
								/>
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
							className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono transition-colors hover:bg-muted"
							aria-label="Gerar código de barras"
							title="Gerar código de barras"
						>
							<Barcode className="h-3 w-3 text-muted-foreground" />
							<span className="truncate">Gerar</span>
						</button>
					)
				})()}
			</td>
			{isProductTab && (
				<td className="min-w-0 px-2 py-2 align-top text-right">
					{product.has_stock_movements
						? (
							<button
								type="button"
								className="rounded px-1 -mx-1 tabular-nums text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
				</td>
			)}
			<td className="min-w-0 px-2 py-2 align-top text-right">
				<QuickSalePriceCell
					productId={product.id}
					blingId={product.bling_id}
					salePriceCents={product.sale_price_cents}
				/>
			</td>
			{isProductTab && (
				<td className="min-w-0 px-2 py-2 align-top text-right">
					<QuickCostPriceCell
						productId={product.id}
						blingId={product.bling_id}
						costPriceCents={product.cost_price_cents}
					/>
				</td>
			)}
			<td className="py-2 pl-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-end gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						aria-label={`Abrir edição de ${product.name}`}
						onClick={() => onEditProduct(product)}
					>
						<PencilLine className="h-4 w-4" aria-hidden />
					</Button>
					<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Mais ações</span>
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
								onPrintLabel(product)
							}}
						>
							<Tag className="mr-2 h-4 w-4" />
							Imprimir etiqueta
						</DropdownMenuItem>
						{product.bling_id && (
							<DropdownMenuItem
								onSelect={(event) => {
									event.preventDefault()
									onSyncFromBling(product.id)
								}}
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
			</td>
		</tr>
	)
})
