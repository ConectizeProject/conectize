'use client'

import Link from 'next/link'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Barcode, Loader2, MoreHorizontal, RefreshCw, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { StockManagementModal } from './StockManagementModal'
import { cn } from '@/lib/utils'
import { ProductEditDialog } from './ProductEditDialog'
import { ProductListCard } from './ProductListCard'
import { ProductListTableRow } from './ProductListTableRow'
import {
	productTableCheckboxClass,
	productTableCheckboxColumnClass,
	productTableCheckboxColumnWidthPx,
	productTableActionsColumnWidthPx,
	getProductTableCheckboxColumnStyle,
	type ProductRow,
} from './product-list-shared'

export type { ProductRow }

type Props = {
	products: ProductRow[]
}

export function ProductsListClient({ products }: Props) {
	const router = useRouter()
	const [stockModalProduct, setStockModalProduct] = useState<{
		id: string
		name: string
		costPriceCents?: number | null
		currentStock: number
	} | null>(null)
	const [filterType, setFilterType] = useState<'product' | 'service'>('product')
	const [editingProduct, setEditingProduct] = useState<Pick<ProductRow, 'id' | 'name' | 'bling_id'> | null>(null)
	const [syncingId, setSyncingId] = useState<string | null>(null)
	const [barcodeGeneratingId, setBarcodeGeneratingId] = useState<string | null>(null)
	const [barcodeGeneratingStage, setBarcodeGeneratingStage] = useState<'updating' | 'syncing' | null>(null)
	/** Código já retornado pela API; mantém UI até a lista refletir (evita flash do "Gerar"). */
	const [barcodeOptimistic, setBarcodeOptimistic] = useState<{ productId: string, barcode: string } | null>(null)
	const [deleteDialog, setDeleteDialog] = useState<{
		id: string
		name: string
		hasBling: boolean
	} | null>(null)
	const [inactivateOnBling, setInactivateOnBling] = useState(true)
	const [deleteSubmitting, setDeleteSubmitting] = useState(false)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
	const [bulkBusy, setBulkBusy] = useState(false)
	const [bulkAction, setBulkAction] = useState<'sync' | 'barcode' | 'price' | null>(null)
	const isProductTab = filterType === 'product'
	const syncInFlightRef = useRef(false)
	const barcodeInFlightRef = useRef(false)

	useEffect(() => {
		setSelectedIds(new Set())
	}, [filterType])

	useEffect(() => {
		if (!barcodeOptimistic) return
		const row = products.find((p) => p.id === barcodeOptimistic.productId)
		const fromServer = row?.barcode ? String(row.barcode).trim() : ''
		if (fromServer && fromServer === barcodeOptimistic.barcode.trim()) {
			setBarcodeOptimistic(null)
		}
	}, [products, barcodeOptimistic])

	const rows = useMemo(
		() =>
			products.map((p) => ({
				...p,
				is_active: p.is_active !== false,
			})),
		[products]
	)

	const filteredRows = useMemo(
		() => {
			if (rows.length === 0) return []

			if (filterType === 'service') {
				return rows.filter((row) => !row.is_variation && row.kind === 'service')
			}

			const parents = rows.filter((r) => !r.is_variation)
			const parentByBlingId = new Map<string, (typeof rows)[number]>()
			const parentById = new Map<string, (typeof rows)[number]>()

			for (const p of parents) {
				parentById.set(p.id, p)
				if (p.bling_id) parentByBlingId.set(p.bling_id, p)
			}

			return rows.filter((row) => {
				const parent = row.is_variation && row.parent_bling_id
					? parentByBlingId.get(row.parent_bling_id) || null
					: !row.is_variation
						? parentById.get(row.id) || null
						: null

				if (!parent) {
					// sem pai conhecido: filtra por kind direto
					const kind = row.kind
					return kind === 'product' || kind == null
				}

				const kind = parent.kind
				return kind === 'product' || kind == null
			})
		},
		[rows, filterType]
	)

	const handleSyncFromBling = useCallback(async (productId: string) => {
		if (syncInFlightRef.current) return
		syncInFlightRef.current = true
		setSyncingId(productId)
		try {
			const res = await fetch('/api/portal/bling/sync-product', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId }),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					variant: 'destructive',
					title: 'Erro na sincronização',
					description: data?.message || data?.error || 'Tente novamente.',
				})
				return
			}
			toast({
				variant: 'success',
				title: 'Dados atualizados pelo Bling.',
			})
			router.refresh()
		} catch (err) {
			const message = err instanceof Error ? err.message : ''
			toast({
				variant: 'destructive',
				title: 'Erro na sincronização',
				description: message || 'Falha de rede ou resposta inválida. Tente novamente.',
			})
		} finally {
			syncInFlightRef.current = false
			setSyncingId(null)
		}
	}, [router])

	const handleGenerateBarcodeFromBling = useCallback(async (productId: string) => {
		if (barcodeInFlightRef.current) return
		barcodeInFlightRef.current = true
		setBarcodeGeneratingId(productId)
		setBarcodeGeneratingStage('updating')
		setBarcodeOptimistic(null)

		function clearBarcodeGenerationOnly () {
			barcodeInFlightRef.current = false
			setBarcodeGeneratingId(null)
			setBarcodeGeneratingStage(null)
		}

		function clearBarcodeGenerationAndOptimistic () {
			clearBarcodeGenerationOnly()
			setBarcodeOptimistic(null)
		}

		try {
			toast({
				variant: 'default',
				title: 'Atualizando',
				description: 'Gerando código de barras e salvando no portal...',
			})

			const res = await fetch(`/api/portal/produtos/${productId}/barcode-generate`, {
				method: 'POST',
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					variant: 'destructive',
					title: 'Erro ao gerar código de barras',
					description: data?.message || data?.error || 'Tente novamente.',
				})
				clearBarcodeGenerationAndOptimistic()
				return
			}

			const rawBarcode = data?.product?.barcode != null ? String(data.product.barcode).trim() : ''
			if (rawBarcode) {
				setBarcodeOptimistic({ productId, barcode: rawBarcode })
			}

			if (data?.shouldSyncToBling) {
				setBarcodeGeneratingStage('syncing')
				toast({
					variant: 'default',
					title: 'Sincronizando',
					description: 'Enviando alteração ao Bling...',
				})

				const syncRes = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ portalFieldsChanged: ['barcode'] }),
				})

				const syncData = await syncRes.json().catch(() => null)
				if (!syncRes.ok || !syncData?.ok) {
					toast({
						variant: 'destructive',
						title: 'Erro ao sincronizar',
						description: syncData?.message || syncData?.error || 'Tente novamente.',
					})
					try {
						await router.refresh()
					} catch {
						// ignore
					}
					clearBarcodeGenerationOnly()
					return
				}
			}

			toast({
				variant: 'success',
				title: 'Finalizado',
				description: 'Código de barras gerado e sincronizado.',
			})
			await router.refresh()
			clearBarcodeGenerationOnly()
		} catch {
			toast({
				variant: 'destructive',
				title: 'Erro ao gerar código de barras',
				description: 'Tente novamente.',
			})
			clearBarcodeGenerationAndOptimistic()
		}
	}, [router])

	const openDeleteDialog = useCallback((product: ProductRow) => {
		const hasBling = Boolean(product.bling_id)
		setDeleteDialog({
			id: product.id,
			name: product.name,
			hasBling,
		})
		setInactivateOnBling(hasBling)
	}, [])

	async function handleConfirmDelete() {
		if (!deleteDialog) return
		setDeleteSubmitting(true)
		try {
			const res = await fetch(`/api/portal/produtos/${deleteDialog.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					inactivateOnBling: deleteDialog.hasBling && inactivateOnBling,
				}),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					variant: 'destructive',
					title: 'Erro ao excluir',
					description: data?.message || data?.error || 'Tente novamente.',
				})
				return
			}
			if (data.blingError) {
				toast({
					variant: 'destructive',
					title: 'Produto excluído no portal',
					description: `Não foi possível inativar no Bling: ${data.blingError}`,
				})
			} else if (deleteDialog.hasBling && data.blingInactivated) {
				toast({
					title: 'Produto excluído e inativado no Bling.',
				})
			} else {
				toast({
					title: 'Produto excluído.',
				})
			}
			setDeleteDialog(null)
			router.refresh()
		} catch {
			toast({
				variant: 'destructive',
				title: 'Erro ao excluir',
				description: 'Tente novamente.',
			})
		} finally {
			setDeleteSubmitting(false)
		}
	}

	const selectedCount = selectedIds.size
	const allVisibleIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows])
	const allSelected =
		allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id))
	const noneSelected = selectedCount === 0
	const selectAllState: boolean | 'indeterminate' = allSelected
		? true
		: noneSelected
			? false
			: 'indeterminate'

	const toggleRowSelected = useCallback((id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (checked) next.add(id)
			else next.delete(id)
			return next
		})
	}, [])

	const toggleSelectAll = useCallback((checked: boolean) => {
		if (!checked) {
			setSelectedIds(new Set())
			return
		}
		setSelectedIds(new Set(allVisibleIds))
	}, [allVisibleIds])

	const handleProductRowClick = useCallback((p: ProductRow) => {
		setEditingProduct({
			id: p.id,
			name: p.name,
			bling_id: p.bling_id ?? null,
		})
	}, [])

	async function handleBulkSyncFromBling () {
		const ids = filteredRows
			.filter((r) => selectedIds.has(r.id) && r.bling_id)
			.map((r) => r.id)
		if (ids.length === 0) {
			toast({
				variant: 'destructive',
				title: 'Nada para sincronizar',
				description: 'Selecione itens vinculados ao Bling.',
			})
			return
		}
		setBulkBusy(true)
		setBulkAction('sync')
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				const res = await fetch('/api/portal/bling/sync-product', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ productId }),
				})
				const data = await res.json().catch(() => null)
				if (res.ok && data?.ok) ok++
				else fail++
			}
			toast({
				variant: fail > 0 ? 'default' : 'success',
				title: 'Atualizar pelo Bling',
				description: `${ok} ok${fail > 0 ? `, ${fail} falha(s)` : ''}.`,
			})
			setSelectedIds(new Set())
			router.refresh()
		} catch {
			toast({ variant: 'destructive', title: 'Erro na operação em massa' })
		} finally {
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	async function handleBulkGenerateBarcode () {
		const ids = filteredRows
			.filter(
				(r) =>
					selectedIds.has(r.id) &&
					r.bling_id &&
					!(r.barcode && String(r.barcode).trim())
			)
			.map((r) => r.id)
		if (ids.length === 0) {
			toast({
				variant: 'destructive',
				title: 'Nada para gerar',
				description: 'Selecione itens com Bling e sem código de barras.',
			})
			return
		}
		setBulkBusy(true)
		setBulkAction('barcode')
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				const res = await fetch(`/api/portal/produtos/${productId}/barcode-generate`, {
					method: 'POST',
				})
				const data = await res.json().catch(() => null)
				if (!res.ok || !data?.ok) {
					fail++
					continue
				}
				if (data?.shouldSyncToBling) {
					const syncRes = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ portalFieldsChanged: ['barcode'] }),
					})
					const syncData = await syncRes.json().catch(() => null)
					if (!syncRes.ok || !syncData?.ok) {
						fail++
						continue
					}
				}
				ok++
			}
			toast({
				variant: fail > 0 ? 'default' : 'success',
				title: 'Gerar código de barras',
				description: `${ok} ok${fail > 0 ? `, ${fail} falha(s)` : ''}.`,
			})
			setSelectedIds(new Set())
			router.refresh()
		} catch {
			toast({ variant: 'destructive', title: 'Erro na operação em massa' })
		} finally {
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	async function handleBulkPushPriceToBling () {
		const ids = filteredRows
			.filter((r) => selectedIds.has(r.id) && r.bling_id)
			.map((r) => r.id)
		if (ids.length === 0) {
			toast({
				variant: 'destructive',
				title: 'Nada para enviar',
				description: 'Selecione itens vinculados ao Bling.',
			})
			return
		}
		setBulkBusy(true)
		setBulkAction('price')
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				const res = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ portalFieldsChanged: ['salePriceCents'] }),
				})
				const data = await res.json().catch(() => null)
				if (res.ok && data?.ok) ok++
				else fail++
			}
			toast({
				variant: fail > 0 ? 'default' : 'success',
				title: 'Atualizar preço no Bling',
				description: `${ok} ok${fail > 0 ? `, ${fail} falha(s)` : ''}.`,
			})
			setSelectedIds(new Set())
			router.refresh()
		} catch {
			toast({ variant: 'destructive', title: 'Erro na operação em massa' })
		} finally {
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	return (
		<div className="min-w-0 w-full max-w-full">
			<nav className="mb-4 flex gap-1 border-b">
				<button
					type="button"
					onClick={() => setFilterType('product')}
					className={cn(
						'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
						filterType === 'product'
							? 'text-foreground border-primary'
							: 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted'
					)}
				>
					Produtos
				</button>
				<button
					type="button"
					onClick={() => setFilterType('service')}
					className={cn(
						'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors sm:px-4',
						filterType === 'service'
							? 'text-foreground border-primary'
							: 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted'
					)}
				>
					Serviços
				</button>
			</nav>

			{selectedCount > 0 && (
				<div
					className="mb-4 flex min-w-0 max-w-full flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
					role="region"
					aria-label="Ações em massa"
				>
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="font-medium text-foreground">
							{selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8"
							disabled={bulkBusy}
							onClick={() => setSelectedIds(new Set())}
						>
							Limpar seleção
						</Button>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8"
							disabled={bulkBusy}
							onClick={() => void handleBulkSyncFromBling()}
						>
							{bulkBusy && bulkAction === 'sync'
								? (
									<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
								)
								: (
									<RefreshCw className="mr-1 h-3.5 w-3.5" />
								)}
							Atualizar pelo Bling
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8"
							disabled={bulkBusy}
							onClick={() => void handleBulkGenerateBarcode()}
						>
							{bulkBusy && bulkAction === 'barcode'
								? (
									<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
								)
								: (
									<Barcode className="mr-1 h-3.5 w-3.5" />
								)}
							Gerar código de barras
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8"
							disabled={bulkBusy}
							onClick={() => void handleBulkPushPriceToBling()}
						>
							{bulkBusy && bulkAction === 'price'
								? (
									<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
								)
								: (
									<Tag className="mr-1 h-3.5 w-3.5" />
								)}
							Atualizar preço no Bling
						</Button>
					</div>
				</div>
			)}

			{filteredRows.length > 0 ? (
				<>
					<div className="flex min-w-0 max-w-full flex-col gap-3 md:hidden" data-product-list="cards">
						{filteredRows.map((product) => (
							<ProductListCard
								key={product.id}
								product={product}
								isSelected={selectedIds.has(product.id)}
								isProductTab={isProductTab}
								bulkBusy={bulkBusy}
								isSyncing={syncingId === product.id}
								isBarcodeGenerating={barcodeGeneratingId === product.id}
								barcodeGeneratingStage={barcodeGeneratingStage}
								optimisticBarcode={
									barcodeOptimistic?.productId === product.id
										? barcodeOptimistic.barcode.trim()
										: null
								}
								onToggleSelect={toggleRowSelected}
								onRowClick={handleProductRowClick}
								onOpenStock={setStockModalProduct}
								onGenerateBarcode={handleGenerateBarcodeFromBling}
								onSyncFromBling={handleSyncFromBling}
								onDelete={openDeleteDialog}
							/>
						))}
					</div>

					<Card className="hidden min-w-0 max-w-full overflow-hidden md:block" data-product-list="table">
						<CardContent className="min-w-0 p-0 sm:p-6">
							<div className="min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain">
								<table className="w-full min-w-0 table-fixed border-collapse text-sm">
									{isProductTab ? (
										<colgroup>
											<col style={{ width: `${productTableCheckboxColumnWidthPx}px` }} />
											{/* Soma das % ≈ 100% da tabela para o espaço extra não ir para a 1ª coluna */}
											<col style={{ width: '34%' }} />
											<col style={{ width: '9%' }} />
											<col style={{ width: '12%' }} />
											<col style={{ width: '7%' }} />
											<col style={{ width: '11%' }} />
											<col style={{ width: '9%' }} />
											<col style={{ width: '11%' }} />
											<col style={{ width: `${productTableActionsColumnWidthPx}px` }} />
										</colgroup>
									) : (
										<colgroup>
											<col style={{ width: `${productTableCheckboxColumnWidthPx}px` }} />
											<col style={{ width: '42%' }} />
											<col style={{ width: '11%' }} />
											<col style={{ width: '16%' }} />
											<col style={{ width: '14%' }} />
											<col style={{ width: '16%' }} />
											<col style={{ width: `${productTableActionsColumnWidthPx}px` }} />
										</colgroup>
									)}
									<thead>
										<tr className="border-b text-xs text-muted-foreground">
											<th
												className={productTableCheckboxColumnClass}
												style={getProductTableCheckboxColumnStyle('head')}
											>
												<div className="flex h-9 max-w-full min-w-0 items-center justify-center">
													<Checkbox
														className={productTableCheckboxClass}
														checked={selectAllState}
														onCheckedChange={(checked) => toggleSelectAll(checked === true)}
														aria-label="Selecionar todos os itens visíveis"
														disabled={bulkBusy}
													/>
												</div>
											</th>
											<th className="min-w-0 py-2 pr-2 text-left font-medium">Nome</th>
											<th className="min-w-0 py-2 px-2 text-left font-medium">SKU</th>
											<th className="min-w-0 py-2 px-2 text-left font-medium">Cód. barras</th>
											{isProductTab && (
												<th className="min-w-0 py-2 px-2 text-right font-medium">Estoque</th>
											)}
											<th className="min-w-0 py-2 px-2 text-right font-medium">Preço venda</th>
											{isProductTab && (
												<th className="min-w-0 py-2 px-2 text-right font-medium">Custo</th>
											)}
											<th className="min-w-0 py-2 px-2 text-center font-medium">Origem</th>
											<th className="min-w-0 py-2 pl-2 text-right font-medium">Ações</th>
										</tr>
									</thead>
									<tbody>
										{filteredRows.map((product) => (
											<ProductListTableRow
												key={product.id}
												product={product}
												isSelected={selectedIds.has(product.id)}
												isProductTab={isProductTab}
												bulkBusy={bulkBusy}
												isSyncing={syncingId === product.id}
												isBarcodeGenerating={barcodeGeneratingId === product.id}
												barcodeGeneratingStage={barcodeGeneratingStage}
												optimisticBarcode={
													barcodeOptimistic?.productId === product.id
														? barcodeOptimistic.barcode.trim()
														: null
												}
												onToggleSelect={toggleRowSelected}
												onRowClick={handleProductRowClick}
												onOpenStock={setStockModalProduct}
												onGenerateBarcode={handleGenerateBarcodeFromBling}
												onSyncFromBling={handleSyncFromBling}
												onDelete={openDeleteDialog}
											/>
										))}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				</>
			) : (
				<Card className="min-w-0 max-w-full">
					<CardContent className="min-w-0 py-8 text-sm text-muted-foreground">
						{filterType === 'product'
							? 'Nenhum produto encontrado.'
							: 'Nenhum serviço encontrado.'}
					</CardContent>
				</Card>
			)}

			{stockModalProduct && (
				<StockManagementModal
					open={!!stockModalProduct}
					onOpenChange={(open) => !open && setStockModalProduct(null)}
					productId={stockModalProduct.id}
					productName={stockModalProduct.name}
					costPriceCents={stockModalProduct.costPriceCents}
					initialStock={stockModalProduct.currentStock}
					onSuccess={() => router.refresh()}
				/>
			)}

			<ProductEditDialog
				open={Boolean(editingProduct)}
				productId={editingProduct?.id ?? null}
				initialName={editingProduct?.name}
				initialBlingId={editingProduct?.bling_id ?? null}
				onOpenChange={(open) => {
					if (!open) setEditingProduct(null)
				}}
				onSuccess={() => router.refresh()}
			/>

			<AlertDialog
				open={Boolean(deleteDialog)}
				onOpenChange={(open) => {
					if (!open && !deleteSubmitting) {
						setDeleteDialog(null)
					}
				}}
			>
				<AlertDialogContent onClick={(event) => event.stopPropagation()}>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir produto?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-4 text-sm text-muted-foreground">
								<p>
									O produto{' '}
									<span className="font-medium text-foreground">{deleteDialog?.name}</span>
									{' '}será desativado no portal (não aparece mais na listagem).
								</p>
								{deleteDialog?.hasBling
									? (
										<label
											htmlFor="inactivate-bling"
											className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-muted/40 p-3 text-left"
										>
											<Checkbox
												id="inactivate-bling"
												checked={inactivateOnBling}
												onCheckedChange={(checked) => setInactivateOnBling(checked === true)}
												disabled={deleteSubmitting}
												className="mt-0.5"
											/>
											<span>
												<span className="font-medium text-foreground">Também inativar no Bling</span>
												<br />
												<span className="text-muted-foreground">
													Envia situação &quot;Inativo&quot; para o cadastro vinculado no Bling (não remove o item lá).
												</span>
											</span>
										</label>
									)
									: (
										<p className="text-xs">
											Este item não está vinculado ao Bling; nada será alterado lá.
										</p>
									)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteSubmitting}>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							onClick={(event) => {
								event.preventDefault()
								void handleConfirmDelete()
							}}
							disabled={deleteSubmitting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteSubmitting
								? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Excluindo...
									</>
								)
								: 'Excluir'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

