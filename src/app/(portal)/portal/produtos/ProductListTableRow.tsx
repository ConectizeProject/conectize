'use client'

import { memo, useCallback } from 'react'
import { Copy, CopyPlus, Loader2, MoreHorizontal, PencilLine, Tag, Trash2 } from 'lucide-react'
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
	productListShowsStock,
	productTableCheckboxClass,
	productTableCheckboxColumnClass,
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

export const ProductListTableRow = memo(function ProductListTableRow ({
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

	const handleRowClick = useCallback((event: React.MouseEvent) => {
		if (event.shiftKey) {
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

	return (
		<tr
			className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
			onClick={handleRowClick}
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
		>
			<td
				className={productTableCheckboxColumnClass}
				style={getProductTableCheckboxColumnStyle('body')}
				onClick={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<div className="flex min-h-[2.75rem] w-full max-w-full min-w-0 items-center justify-center py-2">
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
			</td>
			<td className="min-w-0 py-2 pr-2 align-middle">
				<ProductListNameImageBlock
					product={product}
					nameTruncate
					blingHubConnected={blingHubConnected}
				/>
			</td>
			<td className="min-w-0 px-2 py-2 align-middle">
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
			<td
				className="min-w-0 px-2 py-2 align-middle"
				onPointerDown={(e) => e.stopPropagation()}
			>
				<ProductListBarcodeCell
					serverBarcode={serverBarcode}
					job={barcodeJob}
					onGenerate={() => onGenerateBarcode(product.id)}
					onCopy={copyToClipboard}
				/>
			</td>
			{isProductTab && (
				<td className="min-w-0 px-2 py-2 align-middle text-center">
					{productListShowsStock(product)
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
			{isProductTab && (
				<td className="min-w-0 px-2 py-2 align-middle text-right">
					<QuickCostPriceCell
						productId={product.id}
						blingId={product.bling_id}
						costPriceCents={product.cost_price_cents}
						locked={Boolean(product.is_virtual)}
					/>
				</td>
			)}
			<td className="min-w-0 px-2 py-2 align-middle text-right">
				<QuickSalePriceCell
					productId={product.id}
					blingId={product.bling_id}
					blingHubConnected={blingHubConnected}
					salePriceCents={product.sale_price_cents}
				/>
			</td>
			<td
				className="py-2 pl-2 align-middle text-right"
				onClick={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-end gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						aria-label={`Abrir edição de ${product.name}`}
						onPointerDown={() => prefetchProductForm(product.id)}
						onClick={() => onEditProduct(product)}
					>
						<PencilLine className="h-4 w-4" aria-hidden />
					</Button>
					<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							onPointerDown={() => prefetchProductForm(product.id)}
						>
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
