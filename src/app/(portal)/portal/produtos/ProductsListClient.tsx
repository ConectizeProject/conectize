'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Barcode, CloudUpload, Loader2, PencilLine, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
import { getLabelWindowFeatures } from '@/lib/ordem-print'
import { buildProductLabelHtml } from '@/lib/products/product-label-print'
import {
	GESTAO_LIST_CHUNK,
} from '@/lib/products/portal-gestao-produtos-list'
import { AssistenciaServicoLinkModal } from './AssistenciaServicoLinkModal'
import { BulkEditProductsModal } from './BulkEditProductsModal'
import { useOptionalProdutosGestaoActionsRegistration } from './ProdutosGestaoActionsContext'
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
import type { PortalFieldForBling } from '@/lib/products/bling-sync'

export type { ProductRow }

const PUSH_TO_BLING_FIELD_OPTIONS: { id: PortalFieldForBling; label: string }[] = [
	{ id: 'name', label: 'Nome' },
	{ id: 'description', label: 'Descrição' },
	{ id: 'sku', label: 'SKU' },
	{ id: 'barcode', label: 'Código de barras' },
	{ id: 'salePriceCents', label: 'Preço de venda' },
	{ id: 'isActive', label: 'Situação (ativo/inativo)' },
]

type Props = {
	products: ProductRow[]
	totalCount: number
	/** Falha ao carregar lista no servidor (evitar confundir com catálogo vazio). */
	listLoadError?: boolean
	/** Termo de busca atual (URL `q`), para mensagens de estado vazio. */
	searchQuery?: string
	/** Filtros dedicados na URL (`sku`, `barcode`). */
	filterSku?: string
	filterBarcode?: string
	/** Busca com texto mas sem tokens válidos após sanitização. */
	invalidSearchTokens?: boolean
	/** Filtro na URL: todos, só produtos ou só serviços. */
	filterKind?: 'product' | 'service' | 'all'
	/** Query `?edit=` — abre a modal de edição e remove o parâmetro da URL. */
	initialEditProductId?: string
	/** Query `?newVariationOf=` — abre modal de criação de variação vinculada ao pai. */
	initialCreateVariationParentId?: string
}

export function ProductsListClient({
	products,
	totalCount,
	listLoadError = false,
	searchQuery = '',
	filterSku = '',
	filterBarcode = '',
	invalidSearchTokens = false,
	filterKind = 'all',
	initialEditProductId,
	initialCreateVariationParentId,
}: Props) {
	const router = useRouter()
	const [editingProduct, setEditingProduct] = useState<Pick<ProductRow, 'id' | 'name' | 'bling_id'> | null>(null)
	const [productEditInitialTab, setProductEditInitialTab] = useState<'estoque' | undefined>(undefined)
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
	const [bulkAction, setBulkAction] = useState<'sync' | 'barcode' | 'pushPortal' | null>(null)
	/** Operações em massa (Bling, código de barras, push): concluídos e total (rótulo faltam / total). */
	const [bulkMassProgress, setBulkMassProgress] = useState<{
		completed: number
		total: number
	} | null>(null)
	const [bulkEditOpen, setBulkEditOpen] = useState(false)
	const [bulkEditProductIds, setBulkEditProductIds] = useState<string[]>([])
	const [pushPortalDialogOpen, setPushPortalDialogOpen] = useState(false)
	const [assistenciaLinkModalOpen, setAssistenciaLinkModalOpen] = useState(false)
	const [assistenciaLinkCatalogKind, setAssistenciaLinkCatalogKind] = useState<'product' | 'service'>(
		'product',
	)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [createVariationParent, setCreateVariationParent] = useState<{
		id: string
		name: string
		blingId: string | null
	} | null>(null)
	const [pushPortalFieldKeys, setPushPortalFieldKeys] = useState<Set<PortalFieldForBling>>(
		() => new Set(PUSH_TO_BLING_FIELD_OPTIONS.map((o) => o.id)),
	)
	const isProductTab = filterKind === 'product' || filterKind === 'all'
	const syncInFlightRef = useRef(false)
	const barcodeInFlightRef = useRef(false)

	const [extraRows, setExtraRows] = useState<ProductRow[]>([])
	const [loadMoreBusy, setLoadMoreBusy] = useState(false)
	const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
	const loadMoreInFlightRef = useRef(false)
	const loadMoreCooldownUntilRef = useRef(0)
	const listFilterKey = `${filterKind}::${searchQuery}::${filterSku}::${filterBarcode}`

	useEffect(() => {
		setExtraRows([])
	}, [listFilterKey])

	const mergedProducts = useMemo(() => {
		const ids = new Set(products.map((p) => p.id))
		const tail = extraRows.filter((e) => !ids.has(e.id))
		return [...products, ...tail]
	}, [products, extraRows])

	const canLoadMore =
		!listLoadError && !invalidSearchTokens && mergedProducts.length < totalCount

	const loadNextChunk = useCallback(async () => {
		if (loadMoreInFlightRef.current || loadMoreBusy || listLoadError || mergedProducts.length >= totalCount || invalidSearchTokens) return
		if (Date.now() < loadMoreCooldownUntilRef.current) return
		loadMoreInFlightRef.current = true
		setLoadMoreBusy(true)
		try {
			const params = new URLSearchParams()
			params.set('offset', String(mergedProducts.length))
			params.set('limit', String(GESTAO_LIST_CHUNK))
			const q = searchQuery.trim()
			if (q) params.set('q', q)
			if (filterKind === 'service') params.set('kind', 'service')
			else if (filterKind === 'product') params.set('kind', 'product')
			const sk = filterSku.trim()
			if (sk) params.set('sku', sk)
			const bc = filterBarcode.trim()
			if (bc) params.set('barcode', bc)
			const res = await fetch(`/api/portal/produtos/gestao-list?${params.toString()}`)
			const data = (await res.json().catch(() => null)) as {
				ok?: boolean
				items?: ProductRow[]
				error?: string
			} | null
			if (!res.ok || !data?.ok) {
				toast({
					variant: 'destructive',
					title: 'Erro ao carregar mais itens',
					description: typeof data?.error === 'string' ? data.error : 'Tente novamente.',
				})
				return
			}
			const items = Array.isArray(data.items) ? data.items : []
			if (items.length === 0) return
			setExtraRows((prev) => [...prev, ...items])
			loadMoreCooldownUntilRef.current = Date.now() + 400
		} catch (err) {
			const message = err instanceof Error ? err.message : ''
			toast({
				variant: 'destructive',
				title: 'Erro ao carregar mais itens',
				description: message || 'Falha de rede.',
			})
		} finally {
			loadMoreInFlightRef.current = false
			setLoadMoreBusy(false)
		}
	}, [
		loadMoreBusy,
		listLoadError,
		invalidSearchTokens,
		mergedProducts.length,
		totalCount,
		searchQuery,
		filterSku,
		filterBarcode,
		filterKind,
	])

	useEffect(() => {
		const el = loadMoreSentinelRef.current
		if (!el || !canLoadMore || loadMoreBusy) return

		let cancelled = false
		const obs = new IntersectionObserver(
			(entries) => {
				const [en] = entries
				if (!en?.isIntersecting || cancelled) return
				if (Date.now() < loadMoreCooldownUntilRef.current) return
				void loadNextChunk()
			},
			{ root: null, rootMargin: '120px 0px', threshold: 0 },
		)
		obs.observe(el)
		return () => {
			cancelled = true
			obs.disconnect()
		}
	}, [canLoadMore, loadMoreBusy, loadNextChunk, mergedProducts.length])

	const openCreateDialog = useCallback(() => {
		setEditingProduct(null)
		setCreateVariationParent(null)
		setCreateDialogOpen(true)
	}, [])

	const gestaoUi = useOptionalProdutosGestaoActionsRegistration()
	const registerGestaoHeader = gestaoUi?.register
	const unregisterGestaoHeader = gestaoUi?.unregister

	useEffect(() => {
		if (!registerGestaoHeader || !unregisterGestaoHeader) return
		registerGestaoHeader({
			openAssistenciaLinks: () => {
				setAssistenciaLinkCatalogKind(filterKind === 'service' ? 'service' : 'product')
				setAssistenciaLinkModalOpen(true)
			},
			openCreateProduct: openCreateDialog,
		})
		return () => unregisterGestaoHeader()
	}, [registerGestaoHeader, unregisterGestaoHeader, filterKind, openCreateDialog])

	useEffect(() => {
		setSelectedIds(new Set())
	}, [filterKind])

	useEffect(() => {
		const raw = initialEditProductId?.trim()
		if (!raw) return
		setCreateDialogOpen(false)
		setCreateVariationParent(null)
		setProductEditInitialTab(undefined)
		setEditingProduct({
			id: raw,
			name: '',
			bling_id: null,
		})
		if (typeof window === 'undefined') return
		const url = new URL(window.location.href)
		if (!url.searchParams.get('edit')) return
		url.searchParams.delete('edit')
		router.replace(url.pathname + url.search + url.hash, { scroll: false })
	}, [initialEditProductId, router])

	useEffect(() => {
		const raw = initialCreateVariationParentId?.trim()
		if (!raw) return
		let cancelled = false

		void (async () => {
			try {
				const res = await fetch(`/api/portal/produtos/${encodeURIComponent(raw)}`)
				const data = await res.json().catch(() => null)
				if (cancelled) return
				if (!res.ok || !data?.ok || !data?.product) {
					if (!cancelled) {
						const errBody = data as { message?: string; error?: string } | null
						toast({
							variant: 'destructive',
							title: 'Não foi possível abrir a variação',
							description:
								errBody?.message || errBody?.error || 'Produto pai não encontrado ou sem permissão.',
						})
					}
					return
				}
				const parent = data.product as { id: string; name: string; blingId?: string | null }
				setEditingProduct(null)
				setCreateVariationParent({
					id: parent.id,
					name: parent.name || '',
					blingId: parent.blingId ? String(parent.blingId) : null,
				})
				setCreateDialogOpen(true)
			} catch (err) {
				if (!cancelled) {
					const message = err instanceof Error ? err.message : ''
					toast({
						variant: 'destructive',
						title: 'Não foi possível abrir a variação',
						description: message || 'Erro de rede. Tente novamente.',
					})
				}
			} finally {
				if (typeof window !== 'undefined') {
					const url = new URL(window.location.href)
					if (url.searchParams.get('newVariationOf')) {
						url.searchParams.delete('newVariationOf')
						router.replace(url.pathname + url.search + url.hash, { scroll: false })
					}
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [initialCreateVariationParentId, router])

	useEffect(() => {
		if (!barcodeOptimistic) return
		const row = mergedProducts.find((p) => p.id === barcodeOptimistic.productId)
		const fromServer = row?.barcode ? String(row.barcode).trim() : ''
		if (fromServer && fromServer === barcodeOptimistic.barcode.trim()) {
			setBarcodeOptimistic(null)
		}
	}, [mergedProducts, barcodeOptimistic])

	const rows = useMemo(
		() =>
			mergedProducts.map((p) => ({
				...p,
				is_active: p.is_active !== false,
			})),
		[mergedProducts]
	)

	const filteredRows = useMemo(() => {
		if (rows.length === 0) return []

		const parents = rows.filter((r) => !r.is_variation)
		const parentByBlingId = new Map<string, (typeof rows)[number]>()
		const parentById = new Map<string, (typeof rows)[number]>()

		for (const p of parents) {
			parentById.set(p.id, p)
			if (p.bling_id) parentByBlingId.set(p.bling_id, p)
		}

		function matchesProductCatalogView (row: (typeof rows)[number]): boolean {
			const parent = row.is_variation && row.parent_bling_id
				? parentByBlingId.get(row.parent_bling_id) || null
				: !row.is_variation
					? parentById.get(row.id) || null
					: null

			if (!parent) {
				const k = row.kind
				return k === 'product' || k == null
			}

			const k = parent.kind
			return k === 'product' || k == null
		}

		if (filterKind === 'service') {
			return rows.filter((row) => !row.is_variation && row.kind === 'service')
		}

		if (filterKind === 'product') {
			return rows.filter((row) => matchesProductCatalogView(row))
		}

		return rows.filter((row) => {
			if (!row.is_variation && row.kind === 'service') return true
			return matchesProductCatalogView(row)
		})
	}, [rows, filterKind])

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

		function clearBarcodeGenerationOnly() {
			barcodeInFlightRef.current = false
			setBarcodeGeneratingId(null)
			setBarcodeGeneratingStage(null)
		}

		function clearBarcodeGenerationAndOptimistic() {
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
		setCreateDialogOpen(false)
		setProductEditInitialTab(undefined)
		setEditingProduct({
			id: p.id,
			name: p.name,
			bling_id: p.bling_id ?? null,
		})
	}, [])

	const handleEditProduct = useCallback((p: ProductRow) => {
		setCreateDialogOpen(false)
		setProductEditInitialTab(undefined)
		setEditingProduct({
			id: p.id,
			name: p.name,
			bling_id: p.bling_id ?? null,
		})
	}, [])

	const handleOpenProductStock = useCallback((p: ProductRow) => {
		setCreateDialogOpen(false)
		setProductEditInitialTab('estoque')
		setEditingProduct({
			id: p.id,
			name: p.name,
			bling_id: p.bling_id ?? null,
		})
	}, [])

	const handlePrintLabel = useCallback((p: ProductRow) => {
		const barcode = String(p.barcode || '').trim()
		if (!barcode) {
			toast({
				variant: 'destructive',
				title: 'Produto sem código de barras',
				description: 'Gere ou informe um código de barras antes de imprimir a etiqueta.',
			})
			return
		}
		const w = window.open('', '_blank', getLabelWindowFeatures())
		if (!w) {
			toast({
				variant: 'destructive',
				title: 'Pop-up bloqueado',
				description: 'Permita pop-ups para imprimir a etiqueta.',
			})
			return
		}
		const html = buildProductLabelHtml({
			name: String(p.name || '').trim() || 'Produto',
			sku: String(p.sku || '').trim() || null,
			barcode,
		})
		w.document.open()
		w.document.write(html)
		w.document.close()
	}, [])

	async function handleBulkSyncFromBling() {
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
		const total = ids.length
		setBulkBusy(true)
		setBulkAction('sync')
		setBulkMassProgress({ completed: 0, total })
		let completed = 0
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				setBulkMassProgress({ completed, total })
				const res = await fetch('/api/portal/bling/sync-product', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ productId }),
				})
				const data = await res.json().catch(() => null)
				if (res.ok && data?.ok) ok++
				else fail++
				completed += 1
				setBulkMassProgress({ completed, total })
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
			setBulkMassProgress(null)
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	async function handleBulkGenerateBarcode() {
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
		const total = ids.length
		setBulkBusy(true)
		setBulkAction('barcode')
		setBulkMassProgress({ completed: 0, total })
		let completed = 0
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				setBulkMassProgress({ completed, total })
				const res = await fetch(`/api/portal/produtos/${productId}/barcode-generate`, {
					method: 'POST',
				})
				const data = await res.json().catch(() => null)
				if (!res.ok || !data?.ok) {
					fail++
					completed += 1
					setBulkMassProgress({ completed, total })
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
						completed += 1
						setBulkMassProgress({ completed, total })
						continue
					}
				}
				ok++
				completed += 1
				setBulkMassProgress({ completed, total })
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
			setBulkMassProgress(null)
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	function handleOpenPushPortalToBlingDialog() {
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
		setPushPortalDialogOpen(true)
	}

	function togglePushPortalField(field: PortalFieldForBling, checked: boolean) {
		setPushPortalFieldKeys((prev) => {
			const next = new Set(prev)
			if (checked) next.add(field)
			else next.delete(field)
			return next
		})
	}

	function setAllPushPortalFields(checked: boolean) {
		setPushPortalFieldKeys(
			checked ? new Set(PUSH_TO_BLING_FIELD_OPTIONS.map((o) => o.id)) : new Set(),
		)
	}

	async function handleConfirmPushPortalToBling() {
		const portalFieldsChanged = PUSH_TO_BLING_FIELD_OPTIONS
			.map((o) => o.id)
			.filter((id) => pushPortalFieldKeys.has(id))
		if (portalFieldsChanged.length === 0) {
			toast({
				variant: 'destructive',
				title: 'Selecione ao menos um campo',
				description: 'Marque quais dados do portal serão enviados ao Bling.',
			})
			return
		}

		const ids = filteredRows
			.filter((r) => selectedIds.has(r.id) && r.bling_id)
			.map((r) => r.id)
		if (ids.length === 0) {
			setPushPortalDialogOpen(false)
			return
		}

		setPushPortalDialogOpen(false)
		const total = ids.length
		setBulkBusy(true)
		setBulkAction('pushPortal')
		setBulkMassProgress({ completed: 0, total })
		let completed = 0
		let ok = 0
		let fail = 0
		try {
			for (const productId of ids) {
				setBulkMassProgress({ completed, total })
				const res = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ portalFieldsChanged }),
				})
				const data = await res.json().catch(() => null)
				if (res.ok && data?.ok) ok++
				else fail++
				completed += 1
				setBulkMassProgress({ completed, total })
			}
			toast({
				variant: fail > 0 ? 'default' : 'success',
				title: 'Enviar dados ao Bling',
				description: `${ok} ok${fail > 0 ? `, ${fail} falha(s)` : ''}.`,
			})
			setSelectedIds(new Set())
			router.refresh()
		} catch {
			toast({ variant: 'destructive', title: 'Erro na operação em massa' })
		} finally {
			setBulkMassProgress(null)
			setBulkBusy(false)
			setBulkAction(null)
		}
	}

	return (
		<div className="min-w-0 w-full max-w-full">
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
							onClick={() => {
								setBulkEditProductIds([...selectedIds])
								setBulkEditOpen(true)
							}}
						>
							<PencilLine className="mr-1 h-3.5 w-3.5" />
							Editar em massa
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8 min-w-[10.5rem] justify-center sm:min-w-[12rem]"
							disabled={bulkBusy}
							aria-busy={bulkBusy && bulkAction === 'sync'}
							onClick={() => void handleBulkSyncFromBling()}
						>
							{bulkBusy && bulkAction === 'sync' && bulkMassProgress
								? (
									<>
										<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
										<span className="truncate">
											Atualizando… faltam{' '}
											{bulkMassProgress.total - bulkMassProgress.completed} de{' '}
											{bulkMassProgress.total}
										</span>
									</>
								)
								: bulkBusy && bulkAction === 'sync'
									? (
										<>
											<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
											<span>Atualizando pelo Bling…</span>
										</>
									)
									: (
										<>
											<RefreshCw className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
											Atualizar pelo Bling
										</>
									)}
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8 min-w-[10.5rem] justify-center sm:min-w-[12rem]"
							disabled={bulkBusy}
							aria-busy={bulkBusy && bulkAction === 'barcode'}
							onClick={() => void handleBulkGenerateBarcode()}
						>
							{bulkBusy && bulkAction === 'barcode' && bulkMassProgress
								? (
									<>
										<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
										<span className="truncate">
											Gerando… faltam{' '}
											{bulkMassProgress.total - bulkMassProgress.completed} de{' '}
											{bulkMassProgress.total}
										</span>
									</>
								)
								: bulkBusy && bulkAction === 'barcode'
									? (
										<>
											<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
											<span>Gerando código de barras…</span>
										</>
									)
									: (
										<>
											<Barcode className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
											Gerar código de barras
										</>
									)}
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="h-8 min-w-[10.5rem] justify-center sm:min-w-[12rem]"
							disabled={bulkBusy}
							aria-busy={bulkBusy && bulkAction === 'pushPortal'}
							onClick={() => handleOpenPushPortalToBlingDialog()}
						>
							{bulkBusy && bulkAction === 'pushPortal' && bulkMassProgress
								? (
									<>
										<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
										<span className="truncate">
											Enviando… faltam{' '}
											{bulkMassProgress.total - bulkMassProgress.completed} de{' '}
											{bulkMassProgress.total}
										</span>
									</>
								)
								: bulkBusy && bulkAction === 'pushPortal'
									? (
										<>
											<Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
											<span>Enviando ao Bling…</span>
										</>
									)
									: (
										<>
											<CloudUpload className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
											Enviar dados ao Bling
										</>
									)}
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
								onEditProduct={handleEditProduct}
								onOpenStock={handleOpenProductStock}
								onGenerateBarcode={handleGenerateBarcodeFromBling}
								onSyncFromBling={handleSyncFromBling}
								onDelete={openDeleteDialog}
								onPrintLabel={handlePrintLabel}
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
											<col style={{ width: '37%' }} />
											<col style={{ width: '9%' }} />
											<col style={{ width: '12%' }} />
											<col style={{ width: '7%' }} />
											<col style={{ width: '13%' }} />
											<col style={{ width: '10%' }} />
											<col style={{ width: `${productTableActionsColumnWidthPx}px` }} />
										</colgroup>
									) : (
										<colgroup>
											<col style={{ width: `${productTableCheckboxColumnWidthPx}px` }} />
											<col style={{ width: '48%' }} />
											<col style={{ width: '13%' }} />
											<col style={{ width: '18%' }} />
											<col style={{ width: '20%' }} />
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
											<th className="min-w-0 py-2 px-2 text-left font-medium">Código de barras</th>
											{isProductTab && (
												<th className="min-w-0 py-2 px-2 text-right font-medium">Estoque</th>
											)}
											<th className="min-w-0 py-2 px-2 text-right font-medium">Preço de venda</th>
											{isProductTab && (
												<th className="min-w-0 py-2 px-2 text-right font-medium">Preço de custo</th>
											)}
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
												onEditProduct={handleEditProduct}
												onOpenStock={handleOpenProductStock}
												onGenerateBarcode={handleGenerateBarcodeFromBling}
												onSyncFromBling={handleSyncFromBling}
												onDelete={openDeleteDialog}
												onPrintLabel={handlePrintLabel}
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
					<CardContent className="min-w-0 space-y-4 py-8 text-sm">
						{listLoadError
							? (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" aria-hidden />
									<AlertTitle>Não foi possível carregar o catálogo</AlertTitle>
									<AlertDescription className="space-y-3">
										<p>
											Ocorreu um erro ao buscar os dados. Tente novamente em instantes.
										</p>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
											onClick={() => router.refresh()}
										>
											Tentar novamente
										</Button>
									</AlertDescription>
								</Alert>
							)
							: invalidSearchTokens
								? (
									<div className="space-y-2 text-muted-foreground">
										<p className="font-medium text-foreground">Busca sem tokens válidos</p>
										<p>
											Use palavras ou números (nome, SKU ou código de barras). Termos que ficam
											vazios após remover símbolos especiais não entram na busca.
										</p>
									</div>
								)
								: searchQuery.trim() && mergedProducts.length === 0
									? (
										<div className="space-y-2 text-muted-foreground">
											<p className="font-medium text-foreground">Nenhum resultado para a busca</p>
											<p>
												Não encontramos itens para &quot;{searchQuery.trim()}&quot;. Ajuste o termo ou
												limpe o filtro.
											</p>
										</div>
									)
									: mergedProducts.length === 0
										? (
											<div className="space-y-2 text-muted-foreground">
												<p className="font-medium text-foreground">
													{filterKind === 'all'
														? 'Catálogo vazio'
														: filterKind === 'product'
															? 'Catálogo sem produtos'
															: 'Catálogo sem serviços'}
												</p>
												<p>
													{filterKind === 'all'
														? 'Cadastre produtos ou serviços, ou importe do Bling, para ver itens aqui.'
														: filterKind === 'product'
															? 'Cadastre um produto ou importe do Bling para ver itens aqui.'
															: 'Cadastre um serviço para ver itens aqui.'}
												</p>
											</div>
										)
										: (
											<div className="space-y-2 text-muted-foreground">
												<p className="font-medium text-foreground">Nenhum item nesta visão</p>
												<p>Ajuste os filtros acima para ver outros itens da lista.</p>
											</div>
										)}
					</CardContent>
				</Card>
			)}

			{canLoadMore && mergedProducts.length > 0 ? (
				<div
					className="mt-6 flex flex-col items-center gap-2 border-t border-border/60 pt-4"
					aria-live="polite"
				>
					<div ref={loadMoreSentinelRef} className="h-2 w-full max-w-md shrink-0" aria-hidden />
					{loadMoreBusy ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							Carregando mais…
						</div>
					) : null}
				</div>
			) : null}

			<ProductEditDialog
				open={createDialogOpen || Boolean(editingProduct)}
				mode={editingProduct ? 'edit' : 'create'}
				productId={editingProduct?.id ?? null}
				initialName={editingProduct?.name}
				initialBlingId={editingProduct?.bling_id ?? null}
				initialParentProductId={!editingProduct ? (createVariationParent?.id ?? null) : null}
				initialParentBlingId={!editingProduct ? (createVariationParent?.blingId ?? null) : null}
				initialParentName={!editingProduct ? (createVariationParent?.name ?? null) : null}
				defaultKind={filterKind === 'service' ? 'service' : 'product'}
				initialEditTab={productEditInitialTab}
				onOpenChange={(open) => {
					if (!open) {
						setCreateDialogOpen(false)
						setEditingProduct(null)
						setCreateVariationParent(null)
						setProductEditInitialTab(undefined)
					}
				}}
				onSuccess={() => router.refresh()}
				onNavigateToProductId={(id) => {
					setCreateDialogOpen(false)
					setProductEditInitialTab(undefined)
					setEditingProduct({ id, name: '', bling_id: null })
				}}
				onCreateVariationFromParent={(parent) => {
					setEditingProduct(null)
					setCreateVariationParent({
						id: parent.id,
						name: parent.name,
						blingId: parent.blingId,
					})
					setCreateDialogOpen(true)
				}}
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

			<BulkEditProductsModal
				open={bulkEditOpen}
				onOpenChange={setBulkEditOpen}
				productIds={bulkEditProductIds}
				allowDeviceModel={filterKind !== 'service'}
				onSuccess={() => {
					setSelectedIds(new Set())
					router.refresh()
				}}
			/>

			<AssistenciaServicoLinkModal
				catalogKind={assistenciaLinkCatalogKind}
				open={assistenciaLinkModalOpen}
				onOpenChange={setAssistenciaLinkModalOpen}
				onSuccess={() => router.refresh()}
			/>

			<Dialog open={pushPortalDialogOpen} onOpenChange={setPushPortalDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Enviar dados ao Bling</DialogTitle>
						<DialogDescription>
							Escolha quais campos salvos no portal serão enviados ao Bling para cada item selecionado.
							A sincronização é feita em sequência (um produto após o outro).
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap gap-2 py-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8"
							onClick={() => setAllPushPortalFields(true)}
						>
							Marcar todos
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8"
							onClick={() => setAllPushPortalFields(false)}
						>
							Desmarcar todos
						</Button>
					</div>
					<div className="grid gap-3 py-2">
						{PUSH_TO_BLING_FIELD_OPTIONS.map((opt) => (
							<div key={opt.id} className="flex items-center gap-3">
								<Checkbox
									id={`push-bling-${opt.id}`}
									checked={pushPortalFieldKeys.has(opt.id)}
									onCheckedChange={(checked) => togglePushPortalField(opt.id, checked === true)}
								/>
								<Label htmlFor={`push-bling-${opt.id}`} className="text-sm font-normal leading-tight">
									{opt.label}
								</Label>
							</div>
						))}
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => setPushPortalDialogOpen(false)}
						>
							Cancelar
						</Button>
						<Button type="button" onClick={() => void handleConfirmPushPortalToBling()}>
							Enviar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

