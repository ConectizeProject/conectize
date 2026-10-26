'use client'

import { Eye, Loader2, Plus, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResaleAddCostDialog } from '@/components/resale/ResaleAddCostDialog'
import { ResaleBulkEditTable } from '@/components/resale/ResaleBulkEditTable'
import { ResaleCoverPhotoPreview } from '@/components/resale/ResaleCoverPhotoPreview'
import { ResaleDeleteDeviceDialog } from '@/components/resale/ResaleDeleteDeviceDialog'
import { ResaleDeviceEditHistoryDialog } from '@/components/resale/ResaleDeviceEditHistoryDialog'
import { ResaleDeviceInfoButton } from '@/components/resale/ResaleDeviceInfoButton'
import { ResaleDevicePriceDisplay } from '@/components/resale/ResaleDevicePriceDisplay'
import { ResaleDeviceQuickActionsDropdown } from '@/components/resale/ResaleDeviceQuickActionsDropdown'
import {
	type ResaleMarkSoldDevice,
	ResaleMarkSoldDialog,
} from '@/components/resale/ResaleMarkSoldDialog'
import { ResaleMaskedImeiButton } from '@/components/resale/ResaleMaskedImeiButton'
import { ResaleSimulatePaymentDialog } from '@/components/resale/ResaleSimulatePaymentDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WhatsAppTextModalButton } from '@/components/whatsapp-text-modal'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { getInstallmentRowForCount } from '@/lib/resale/credit-installment-max-fee'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
import {
	REVENDA_LIST_PAGE_SIZE,
	type ResaleDeviceRow,
} from '@/lib/seminovos/fetch-seminovos-data'
import { groupDevicesByModel } from '@/lib/seminovos/group-devices-by-model'
import {
	copyImeiWithPortalToast,
	copyTextWithPortalToast,
	printResaleDeviceLabel,
} from '@/lib/seminovos/resale-portal-clipboard'
import {
	buildCopyClienteText,
	buildCopyLojistaText,
} from '@/lib/seminovos/seminovos-device-actions'
import { buildConectizeStockWhatsAppTexts } from '@/lib/seminovos/whatsapp-stock-broadcast-text'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { cn } from '@/lib/utils'
import { formatDateBr } from '@/lib/utils/format-date'
import { maskedFromCents } from '@/lib/utils/money'
import { ResaleDeviceTermsDialog } from '../seminovos/ResaleDeviceTermsDialog'
import { SeminovosFilterCollapsible } from '../seminovos/SeminovosFilterCollapsible'

type PaymentMethod = {
	id: string
	description: string
	type: string
	fee_percent: number
	credit_installment_fees: { installments: number; fee_percent: number }[]
	sort_order: number
}

type FilterInitial = {
	q: string
	condition: string
	storageGb: string
	color: string
	purchaseDateFrom: string
	purchaseDateTo: string
	saleDateFrom?: string
	saleDateTo?: string
	stockType: 'all'
	deviceName?: string
	valueMin?: string
	valueMax?: string
	includeSold?: boolean
}

type Props = {
	devices: Array<
		ResaleDeviceRow & {
			display_image_url: string | null
			display_image_full_url?: string | null
		}
	>
	totalCount: number
	hasMoreInitial: boolean
	/** Inclui vendidos na query (filtro sold=1, data de venda ou busca por IMEI). */
	listIncludeSold: boolean
	paymentMethods: PaymentMethod[]
	isRetailer: boolean
	isAdmin?: boolean
	/** Staff e admin: marcar/editar/cancelar venda e histórico. */
	canManageSale?: boolean
	filterInitialValues: FilterInitial
	distinctDeviceNames: string[]
}

type CatalogDeviceRow = Props['devices'][number]

const noop = () => {}

function formatStorageLabel(raw: string | null | undefined): string | null {
	if (!raw?.trim()) return null
	const t = raw.trim()
	return /gb/i.test(t) ? t : `${t} GB`
}

function sumCostsCents(device: CatalogDeviceRow) {
	return (device.costs || []).reduce(
		(acc, row) => acc + (Number(row.value_cents) || 0),
		0,
	)
}

function moneyOrEmpty (cents: number | null | undefined) {
	if (cents == null || cents <= 0) return '-'
	return `R$ ${maskedFromCents(cents)}`
}

export function RevendaListagemClient({
	devices,
	totalCount,
	hasMoreInitial,
	listIncludeSold,
	paymentMethods,
	isRetailer,
	isAdmin = false,
	canManageSale = false,
	filterInitialValues,
	distinctDeviceNames,
}: Props) {
	const router = useRouter()
	const [priceMode, setPriceMode] = useState<'varejo' | 'atacado'>('varejo')
	const [showAdminFigures, setShowAdminFigures] = useState(false)
	const [simulateDevice, setSimulateDevice] = useState<CatalogDeviceRow | null>(
		null,
	)
	const [costTarget, setCostTarget] = useState<CatalogDeviceRow | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<CatalogDeviceRow | null>(
		null,
	)
	const [sellTarget, setSellTarget] = useState<ResaleMarkSoldDevice | null>(
		null,
	)
	const [sellDialogMode, setSellDialogMode] = useState<'create' | 'edit'>(
		'create',
	)
	const [isCancellingSaleId, setIsCancellingSaleId] = useState<string | null>(
		null,
	)
	const [historyDeviceId, setHistoryDeviceId] = useState<string | null>(null)
	const [termsDevice, setTermsDevice] = useState<ResaleMarkSoldDevice | null>(
		null,
	)
	const [showTermsDialog, setShowTermsDialog] = useState(false)
	const [isBulkEdit, setIsBulkEdit] = useState(false)
	const [extraDevices, setExtraDevices] = useState<CatalogDeviceRow[]>([])
	const [loadMoreBusy, setLoadMoreBusy] = useState(false)
	const [hasMore, setHasMore] = useState(hasMoreInitial)
	const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
	const loadMoreInFlightRef = useRef(false)
	const loadMoreCooldownUntilRef = useRef(0)

	const listFilterKey = useMemo(
		() =>
			[
				filterInitialValues.q,
				filterInitialValues.condition,
				filterInitialValues.storageGb,
				filterInitialValues.color,
				filterInitialValues.purchaseDateFrom,
				filterInitialValues.purchaseDateTo,
				filterInitialValues.saleDateFrom || '',
				filterInitialValues.saleDateTo || '',
				filterInitialValues.deviceName || '',
				filterInitialValues.stockType,
				filterInitialValues.valueMin || '',
				filterInitialValues.valueMax || '',
				listIncludeSold ? '1' : '0',
			].join('|'),
		[filterInitialValues, listIncludeSold],
	)

	useEffect(() => {
		setExtraDevices([])
		setHasMore(hasMoreInitial)
	}, [listFilterKey, hasMoreInitial, devices])

	const orderedDevices = useMemo(() => {
		const seen = new Set(devices.map((d) => d.id))
		const merged = [
			...devices,
			...extraDevices.filter((d) => !seen.has(d.id)),
		]
		if (!listIncludeSold) {
			return groupDevicesByModel(merged).flatMap((g) => g.devices)
		}
		const available = merged.filter((d) => !d.sold)
		const sold = merged
			.filter((d) => d.sold)
			.slice()
			.sort((a, b) => {
				const saleA = a.sale_date || ''
				const saleB = b.sale_date || ''
				if (saleA !== saleB) return saleB.localeCompare(saleA)
				return String(b.created_at || '').localeCompare(String(a.created_at || ''))
			})
		return [
			...groupDevicesByModel(available).flatMap((g) => g.devices),
			...sold,
		]
	}, [devices, extraDevices, listIncludeSold])

	const canLoadMore = hasMore && orderedDevices.length < totalCount

	const loadNextChunk = useCallback(async () => {
		if (loadMoreInFlightRef.current || loadMoreBusy || !canLoadMore) return
		if (Date.now() < loadMoreCooldownUntilRef.current) return
		loadMoreInFlightRef.current = true
		setLoadMoreBusy(true)
		try {
			const params = new URLSearchParams()
			params.set('offset', String(orderedDevices.length))
			params.set('limit', String(REVENDA_LIST_PAGE_SIZE))
			params.set('stockType', 'all')
			const q = filterInitialValues.q.trim()
			if (q) params.set('q', q)
			if (filterInitialValues.condition) {
				params.set('condition', filterInitialValues.condition)
			}
			if (filterInitialValues.storageGb) {
				params.set('storageGb', filterInitialValues.storageGb)
			}
			if (filterInitialValues.color) {
				params.set('color', filterInitialValues.color)
			}
			if (filterInitialValues.purchaseDateFrom) {
				params.set('purchaseDateFrom', filterInitialValues.purchaseDateFrom)
			}
			if (filterInitialValues.purchaseDateTo) {
				params.set('purchaseDateTo', filterInitialValues.purchaseDateTo)
			}
			if (filterInitialValues.saleDateFrom) {
				params.set('saleDateFrom', filterInitialValues.saleDateFrom)
			}
			if (filterInitialValues.saleDateTo) {
				params.set('saleDateTo', filterInitialValues.saleDateTo)
			}
			if (filterInitialValues.deviceName) {
				params.set('deviceName', filterInitialValues.deviceName)
			}
			if (filterInitialValues.valueMin) {
				params.set('valueMin', filterInitialValues.valueMin)
			}
			if (filterInitialValues.valueMax) {
				params.set('valueMax', filterInitialValues.valueMax)
			}
			if (listIncludeSold) {
				params.set('includeSold', '1')
			}

			const res = await portalFetch(`/api/portal/resale-devices?${params.toString()}`)
			const data = await res?.json().catch(() => null) as {
				ok?: boolean
				devices?: CatalogDeviceRow[]
				hasMore?: boolean
				error?: string
			} | null
			if (!res?.ok || !data?.ok) {
				toast({
					variant: 'destructive',
					title: 'Erro ao carregar mais aparelhos',
					description:
						typeof data?.error === 'string' ? data.error : 'Tente novamente.',
				})
				return
			}
			const rawItems = Array.isArray(data.devices) ? data.devices : []
			if (rawItems.length === 0) {
				setHasMore(false)
				return
			}
			const items = isAdmin
				? rawItems
				: rawItems.map((d) => ({
					...d,
					purchase_value_cents: null,
					costs: [],
				}))
			setExtraDevices((prev) => [...prev, ...items])
			setHasMore(Boolean(data.hasMore))
			loadMoreCooldownUntilRef.current = Date.now() + 400
		} catch (err) {
			const message = err instanceof Error ? err.message : ''
			toast({
				variant: 'destructive',
				title: 'Erro ao carregar mais aparelhos',
				description: message || 'Falha de rede.',
			})
		} finally {
			loadMoreInFlightRef.current = false
			setLoadMoreBusy(false)
		}
	}, [
		canLoadMore,
		filterInitialValues,
		isAdmin,
		listIncludeSold,
		loadMoreBusy,
		orderedDevices.length,
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
			{ root: null, rootMargin: '160px 0px', threshold: 0 },
		)
		obs.observe(el)
		return () => {
			cancelled = true
			obs.disconnect()
		}
	}, [canLoadMore, loadMoreBusy, loadNextChunk, orderedDevices.length])

	const buildWhatsAppTexts = useCallback(() => {
		const available = orderedDevices.filter((d) => !d.sold)
		return buildConectizeStockWhatsAppTexts(available)
	}, [orderedDevices])

	const openSimulateForDevice = useCallback((d: CatalogDeviceRow) => {
		setSimulateDevice(d)
	}, [])

	const handleCatalogPrintLabel = useCallback((d: CatalogDeviceRow) => {
		printResaleDeviceLabel(d)
	}, [])

	const handleCatalogCopyLojista = useCallback(async (d: CatalogDeviceRow) => {
		await copyTextWithPortalToast(buildCopyLojistaText(d))
	}, [])

	const handleCatalogCopyCliente = useCallback(async (d: CatalogDeviceRow) => {
		await copyTextWithPortalToast(buildCopyClienteText(d))
	}, [])

	const handleCatalogCopyImei = useCallback(async (d: CatalogDeviceRow) => {
		await copyImeiWithPortalToast(d.imei)
	}, [])

	const toMarkSoldDevice = useCallback(
		(d: CatalogDeviceRow | ResaleMarkSoldDevice): ResaleMarkSoldDevice => {
			return {
				id: d.id,
				device_name: d.device_name ?? null,
				model: d.model ?? null,
				color: d.color ?? null,
				storage_gb: d.storage_gb ?? null,
				battery: d.battery ?? null,
				info: 'info' in d ? (d.info ?? null) : null,
				imei: d.imei ?? null,
				serial: 'serial' in d ? (d.serial ?? null) : null,
				purchase_value_cents: d.purchase_value_cents ?? null,
				wholesale_value_cents: d.wholesale_value_cents ?? null,
				sale_value_cents: d.sale_value_cents ?? null,
				sold_for_cents: d.sold_for_cents ?? null,
				sale_date: d.sale_date ?? null,
				costs: ('costs' in d && Array.isArray(d.costs) ? d.costs : []).map(
					(c) => ({
						id: c.id,
						description: c.description ?? '',
						value_cents: c.value_cents ?? 0,
					}),
				),
				payment_method_id:
					'payment_method_id' in d ? (d.payment_method_id ?? null) : null,
				payment_installments:
					'payment_installments' in d ? (d.payment_installments ?? null) : null,
				sale_payment_methods:
					'sale_payment_methods' in d ? (d.sale_payment_methods ?? null) : null,
				buyer_name: 'buyer_name' in d ? (d.buyer_name ?? null) : null,
				buyer_cpf: 'buyer_cpf' in d ? (d.buyer_cpf ?? null) : null,
				sale_details: 'sale_details' in d ? (d.sale_details ?? null) : null,
				sale_commission_user_id:
					'sale_commission_user_id' in d
						? (d.sale_commission_user_id ?? null)
						: null,
			}
		},
		[],
	)

	const handleMarkSold = useCallback(
		(d: CatalogDeviceRow) => {
			setSellDialogMode('create')
			setSellTarget(toMarkSoldDevice(d))
		},
		[toMarkSoldDevice],
	)

	const handleEditSale = useCallback(
		async (d: CatalogDeviceRow) => {
			try {
				const res = await portalFetch(`/api/portal/resale-devices/${d.id}`)
				const data = await res?.json().catch(() => null)
				if (data?.ok && data.device) {
					setSellDialogMode('edit')
					setSellTarget(toMarkSoldDevice(data.device as ResaleMarkSoldDevice))
					return
				}
				toast({
					variant: 'destructive',
					title: 'Erro',
					description: 'Não foi possível carregar os dados da venda.',
				})
			} catch {
				toast({
					variant: 'destructive',
					title: 'Erro',
					description: 'Não foi possível carregar os dados da venda.',
				})
			}
		},
		[toMarkSoldDevice],
	)

	const handleCancelSale = useCallback(
		async (d: CatalogDeviceRow) => {
			if (isCancellingSaleId) return
			if (
				!(await appConfirm({
					title: 'Cancelar a venda?',
					description:
						'O valor, a data e os dados da venda serão removidos. O aparelho volta para o estoque.',
					confirmLabel: 'Cancelar venda',
					destructive: true,
				}))
			)
				return

			setIsCancellingSaleId(d.id)
			try {
				const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sold: false,
						sold_for_cents: null,
						sale_date: null,
						payment_method_id: null,
						payment_installments: null,
						sale_payment_methods: [],
						buyer_name: null,
						buyer_cpf: null,
						sale_details: null,
					}),
				})
				const data = await res?.json().catch(() => null)
				if (!res?.ok || data?.ok !== true) {
					throw new Error(data?.message || 'Não foi possível cancelar a venda.')
				}
				toast({ description: 'Venda cancelada', duration: 2000 })
				router.refresh()
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Erro ao cancelar a venda.'
				toast({ variant: 'destructive', title: 'Erro', description: message })
			} finally {
				setIsCancellingSaleId(null)
			}
		},
		[isCancellingSaleId, router],
	)

	const handleEditDevice = useCallback(
		(d: CatalogDeviceRow) => {
			router.push(revendaPath.device(d.id))
		},
		[router],
	)

	const priceToggle = (
		<div className="flex items-center gap-2">
			<div
				role="group"
				aria-label="Modo de preço"
				className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5"
			>
				<button
					type="button"
					className={cn(
						'h-9 min-w-[4.5rem] rounded px-3 text-sm font-semibold transition-colors',
						priceMode === 'varejo'
							? 'bg-primary text-primary-foreground shadow'
							: 'text-muted-foreground hover:bg-muted',
					)}
					onClick={() => setPriceMode('varejo')}
				>
					Varejo
				</button>
				<button
					type="button"
					className={cn(
						'h-9 min-w-[4.5rem] rounded px-3 text-sm font-semibold transition-colors',
						priceMode === 'atacado'
							? 'bg-primary text-primary-foreground shadow'
							: 'text-muted-foreground hover:bg-muted',
					)}
					onClick={() => setPriceMode('atacado')}
				>
					Atacado
				</button>
			</div>
			{isAdmin ? (
				<Button
					type="button"
					variant={showAdminFigures ? 'default' : 'outline'}
					size="icon"
					className="h-10 w-10 shrink-0 touch-manipulation"
					aria-pressed={showAdminFigures}
					aria-label={
						showAdminFigures
							? 'Ocultar custo e venda'
							: 'Exibir custo e venda'
					}
					title={
						showAdminFigures
							? 'Ocultar custo e venda'
							: 'Exibir custo e venda'
					}
					onClick={() => setShowAdminFigures((current) => !current)}
				>
					<Eye className="h-4 w-4" aria-hidden />
				</Button>
			) : null}
			{!isBulkEdit ? (
				<>
					{isAdmin ? (
						<Button
							type="button"
							variant="outline"
							className="h-10 shrink-0"
							onClick={() => setIsBulkEdit(true)}
						>
							Edição em massa
						</Button>
					) : null}
					<WhatsAppTextModalButton
						buildTexts={buildWhatsAppTexts}
						className="h-10 w-10 shrink-0 touch-manipulation"
					/>
					{isAdmin ? (
						<Button
							variant="default"
							size="icon"
							className="h-10 w-10 shrink-0 touch-manipulation"
							asChild
						>
							<Link href={revendaPath.nova} aria-label="Cadastrar aparelho">
								<Plus className="h-4 w-4" aria-hidden />
							</Link>
						</Button>
					) : null}
				</>
			) : null}
		</div>
	)

	return (
		<div className="space-y-4">
			<SeminovosFilterCollapsible
				key={[
					filterInitialValues.q,
					filterInitialValues.condition,
					filterInitialValues.storageGb,
					filterInitialValues.color,
					filterInitialValues.purchaseDateFrom,
					filterInitialValues.purchaseDateTo,
					filterInitialValues.saleDateFrom || '',
					filterInitialValues.saleDateTo || '',
					filterInitialValues.deviceName || '',
					filterInitialValues.stockType,
					filterInitialValues.valueMin || '',
					filterInitialValues.valueMax || '',
					filterInitialValues.includeSold ? '1' : '0',
				].join('|')}
				initialValues={filterInitialValues}
				filterFormAction={revendaPath.listagem}
				distinctDeviceNames={distinctDeviceNames}
				catalogMode
				showIncludeSoldFilter={canManageSale}
				trailingSlot={priceToggle}
				quickFilters={{
					notTested: false,
					notAdvertised: false,
					noLabel: false,
					withInfo: false,
					onToggleNotTested: noop,
					onToggleNotAdvertised: noop,
					onToggleNoLabel: noop,
					onToggleWithInfo: noop,
				}}
			/>

			{isBulkEdit && isAdmin ? (
				<ResaleBulkEditTable
					devices={orderedDevices}
					onCancel={() => setIsBulkEdit(false)}
					onSaved={() => setIsBulkEdit(false)}
					onEdit={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) handleEditDevice(row)
					}}
					onMarkSold={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) handleMarkSold(row)
					}}
					onEditSale={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) void handleEditSale(row)
					}}
					onCancelSale={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) void handleCancelSale(row)
					}}
					onAddCost={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) setCostTarget(row)
					}}
					onDelete={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) setDeleteTarget(row)
					}}
					onSimulate={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) openSimulateForDevice(row)
					}}
					onPrintLabel={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) handleCatalogPrintLabel(row)
					}}
					onCopyLojista={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) void handleCatalogCopyLojista(row)
					}}
					onCopyCliente={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) void handleCatalogCopyCliente(row)
					}}
					onCopyImei={(d) => {
						const row = orderedDevices.find((x) => x.id === d.id)
						if (row) void handleCatalogCopyImei(row)
					}}
				/>
			) : orderedDevices.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					Nenhum aparelho disponível.
					{isAdmin ? (
						<>
							{' '}
							<Link href={revendaPath.nova} className="text-primary underline">
								Cadastrar aparelho
							</Link>
						</>
					) : null}
				</div>
			) : (
				<>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
					{orderedDevices.map((d) => {
						const title =
							(d.device_name || d.model || 'Aparelho').trim() || 'Aparelho'
						const storageLabel = formatStorageLabel(d.storage_gb)
						const displayFullUrl = d.display_image_full_url || d.display_image_url
						const imgOk = Boolean(displayFullUrl)
						const isNovo = d.stock_type === 'lacrado'
						const saleCents =
							priceMode === 'varejo'
								? (d.sale_value_cents ?? null)
								: (d.wholesale_value_cents ?? null)
						const row12 =
							saleCents != null && saleCents > 0
								? getInstallmentRowForCount(saleCents, paymentMethods, 12)
								: null

						const propertySegments: string[] = []
						if (storageLabel) propertySegments.push(storageLabel)
						if (d.color) {
							propertySegments.push(
								`${getSeminovosColorEmoji(d.color)} ${d.color}`.trim(),
							)
						}
						if (!isNovo) {
							if (d.battery) propertySegments.push(d.battery)
							if (d.condition) propertySegments.push(d.condition)
						}

						return (
							<div key={d.id} className="group/card relative h-full">
								<Card className="h-full overflow-hidden border transition-shadow duration-200 hover:shadow-md hover:border-primary/30">
									<div className="relative aspect-square overflow-hidden bg-muted">
										{d.sold ? (
											<span className="pointer-events-none absolute left-2 top-2 z-[2] rounded bg-zinc-900/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
												Vendido
											</span>
										) : isNovo ? (
											<span className="pointer-events-none absolute left-2 top-2 z-[2] rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
												Novo
											</span>
										) : null}
										{imgOk ? (
											<ResaleCoverPhotoPreview
												thumbUrl={displayFullUrl}
												fullUrl={displayFullUrl}
												alt=""
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-muted-foreground">
												<Smartphone
													className="h-14 w-14 opacity-35"
													aria-hidden
												/>
											</div>
										)}
										<div
											className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] backdrop-blur-[11px] sm:h-[34%]"
											style={{
												maskImage:
													'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
												WebkitMaskImage:
													'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
											}}
											aria-hidden
										/>
										<div
											className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[52%] sm:h-[48%]"
											style={{
												background:
													'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 12%, rgba(0,0,0,0.42) 32%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.05) 82%, transparent 100%)',
											}}
											aria-hidden
										/>
										<div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] p-3 pt-10 sm:p-3.5 sm:pt-12">
											<h2 className="text-lg font-bold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] line-clamp-3 sm:text-xl">
												{title}
											</h2>
										</div>
									</div>
									<Link
										href={revendaPath.vitrine(d.id)}
										className="group block rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<CardContent className="flex flex-col gap-3 p-4 pt-3">
											{propertySegments.length > 0 ? (
												<p className="text-xs leading-snug text-muted-foreground">
													{propertySegments.join(' · ')}
												</p>
											) : null}
											{d.imei?.trim() ? (
												<ResaleMaskedImeiButton
													imei={d.imei}
													className="self-start"
												/>
											) : null}
											{showAdminFigures ? (
												<dl className="space-y-1 border-t border-border/80 pt-3 text-xs text-muted-foreground">
													<div className="flex items-baseline justify-between gap-3">
														<dt>Compra</dt>
														<dd className="font-medium tabular-nums text-foreground">
															{moneyOrEmpty(d.purchase_value_cents)}
														</dd>
													</div>
													<div className="flex items-baseline justify-between gap-3">
														<dt>Custos</dt>
														<dd className="font-medium tabular-nums text-foreground">
															{moneyOrEmpty(sumCostsCents(d))}
														</dd>
													</div>
													<div className="flex items-baseline justify-between gap-3">
														<dt>Data da compra</dt>
														<dd className="font-medium text-foreground">
															{d.purchase_date
																? formatDateBr(`${d.purchase_date}T12:00:00`)
																: '-'}
														</dd>
													</div>
													<div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-1">
														<dt>Venda lojista</dt>
														<dd className="font-medium tabular-nums text-foreground">
															{moneyOrEmpty(d.wholesale_value_cents)}
														</dd>
													</div>
													<div className="flex items-baseline justify-between gap-3">
														<dt>Cliente final</dt>
														<dd className="font-medium tabular-nums text-foreground">
															{moneyOrEmpty(d.sale_value_cents)}
														</dd>
													</div>
												</dl>
											) : (
												<ResaleDevicePriceDisplay
													saleCents={saleCents}
													row12={row12}
													className="space-y-2 border-t border-border/80 pt-3"
												/>
											)}
										</CardContent>
									</Link>
								</Card>
								{d.info?.trim() ? (
									<ResaleDeviceInfoButton
										info={d.info}
										className={cn(
											'absolute left-2 z-[5]',
											d.sold || isNovo ? 'top-9' : 'top-2',
										)}
									/>
								) : null}
								<div
									className="absolute right-2 top-2 z-[5] opacity-0 pointer-events-none transition-opacity duration-200 [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto group-hover/card:opacity-100 group-hover/card:pointer-events-auto group-focus-within/card:opacity-100 group-focus-within/card:pointer-events-auto"
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()
									}}
								>
									<ResaleDeviceQuickActionsDropdown
										device={d}
										includeSimulate={!d.sold}
										onSimulate={() => openSimulateForDevice(d)}
										onPrintLabel={() => handleCatalogPrintLabel(d)}
										onCopyLojista={() => void handleCatalogCopyLojista(d)}
										onCopyCliente={() => void handleCatalogCopyCliente(d)}
										onCopyImei={() => void handleCatalogCopyImei(d)}
										isAdmin={isAdmin}
										canManageSale={canManageSale}
										deviceSold={d.sold}
										onEdit={() => handleEditDevice(d)}
										onMarkSold={() => handleMarkSold(d)}
										onEditSale={() => void handleEditSale(d)}
										onCancelSale={() => void handleCancelSale(d)}
										onViewHistory={() => setHistoryDeviceId(d.id)}
										onAddCost={() => setCostTarget(d)}
										onDelete={() => setDeleteTarget(d)}
									/>
								</div>
							</div>
						)
					})}
				</div>
				{canLoadMore || loadMoreBusy ? (
					<div
						ref={loadMoreSentinelRef}
						className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
						aria-live="polite"
					>
						{loadMoreBusy ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
								Carregando mais aparelhos…
							</>
						) : (
							<span className="sr-only">Rolando para carregar mais</span>
						)}
					</div>
				) : null}
				</>
			)}
			<ResaleSimulatePaymentDialog
				device={
					simulateDevice
						? {
								sale_value_cents: simulateDevice.sale_value_cents,
								wholesale_value_cents: simulateDevice.wholesale_value_cents,
							}
						: null
				}
				paymentMethods={paymentMethods}
				onClose={() => setSimulateDevice(null)}
			/>
			<ResaleAddCostDialog
				deviceId={costTarget?.id ?? null}
				open={Boolean(costTarget)}
				onOpenChange={(open) => {
					if (!open) setCostTarget(null)
				}}
			/>
			<ResaleDeleteDeviceDialog
				deviceId={deleteTarget?.id ?? null}
				deviceLabel={
					deleteTarget
						? deleteTarget.device_name || deleteTarget.model || 'Aparelho'
						: null
				}
				open={Boolean(deleteTarget)}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null)
				}}
			/>
			<ResaleMarkSoldDialog
				open={Boolean(sellTarget)}
				onOpenChange={(open) => {
					if (!open) {
						setSellTarget(null)
						setSellDialogMode('create')
					}
				}}
				device={sellTarget}
				mode={sellDialogMode}
				isAdmin={isAdmin}
				canViewPurchaseValue={isAdmin}
				onSold={(updated, meta) => {
					setSellTarget(null)
					setSellDialogMode('create')
					if (meta.generateWarrantyTerm) {
						setTermsDevice(updated)
						setShowTermsDialog(true)
					}
					router.refresh()
				}}
			/>
			{historyDeviceId ? (
				<ResaleDeviceEditHistoryDialog
					deviceId={historyDeviceId}
					isAdmin={isAdmin}
					open={Boolean(historyDeviceId)}
					onOpenChange={(open) => {
						if (!open) setHistoryDeviceId(null)
					}}
				/>
			) : null}
			<ResaleDeviceTermsDialog
				open={showTermsDialog}
				onOpenChange={setShowTermsDialog}
				device={
					termsDevice
						? {
								id: termsDevice.id,
								device_name: termsDevice.device_name,
								model: termsDevice.model,
								color: termsDevice.color,
								storage_gb: termsDevice.storage_gb,
								battery: termsDevice.battery,
								imei: termsDevice.imei,
								serial: termsDevice.serial ?? null,
								sold_for_cents: termsDevice.sold_for_cents,
								sale_date: termsDevice.sale_date,
								buyer_name: termsDevice.buyer_name ?? null,
								buyer_cpf: termsDevice.buyer_cpf ?? null,
								sale_details: termsDevice.sale_details ?? null,
								payment_method_id: termsDevice.payment_method_id ?? null,
								payment_installments: termsDevice.payment_installments ?? null,
								sale_payment_methods: termsDevice.sale_payment_methods ?? null,
							}
						: null
				}
			/>
		</div>
	)
}
