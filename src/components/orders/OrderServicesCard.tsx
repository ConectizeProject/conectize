'use client'

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useOrderServicesTotal } from './OrderServicesTotalContext'
import { Check, ChevronsUpDown, Loader2, Plus, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	parseMoneyToCents,
	formatCentsBr,
	formatMoneyInputBr,
} from '@/lib/utils/format-money'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

export type ServiceItemDb = {
	description?: string | null
	valueCents?: number | null
	costCents?: number | null
	kind?: 'service' | 'product' | null
	quantity?: number | null
	unitValueCents?: number | null
	unitCostCents?: number | null
	sourceProductId?: string | null
}

export type ServiceLine = {
	id: string
	kind: 'service' | 'product'
	description: string
	quantity: string
	value: string
	cost: string
	sourceProductId?: string | null
}

type CatalogItem = {
	id: string
	kind: 'service' | 'product'
	name: string
	sku?: string | null
	barcode?: string | null
	imageUrl?: string | null
	salePriceCents: number
	costPriceCents: number
	currentStock?: number | null
	isVariation?: boolean
	hasVariations?: boolean
}

export function makeServiceId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return String(Date.now()) + String(Math.random()).slice(2)
}

/** Gera id estável para item vindo do servidor (evita hydration mismatch). */
function stableServiceId(index: number, item: ServiceItemDb): string {
	const valueCents = Math.max(0, Number(item?.valueCents) || 0)
	const costCents = Math.max(0, Number(item?.costCents) || 0)
	const desc = String(item?.description || '').trim().slice(0, 40).replace(/\s+/g, '-')
	const kind = item.kind === 'product' ? 'product' : 'service'
	const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
	return `service-${index}-${kind}-${quantity}-${desc || 'item'}-${valueCents}-${costCents}`
}

function dbToLine(item: ServiceItemDb, index: number): ServiceLine {
	const kind = item.kind === 'product' ? 'product' : 'service'
	const quantity =
		kind === 'product'
			? (() => {
				const raw = Number(item?.quantity ?? 1)
				if (!Number.isFinite(raw) || raw <= 0) return '1'
				return String(Math.min(9999, Math.max(1, Math.trunc(raw))))
			})()
			: '1'

	const unitValueCentsRaw = item.unitValueCents ?? item.valueCents ?? 0
	const unitCostCentsRaw = item.unitCostCents ?? item.costCents ?? 0

	const unitValueCents = Math.max(0, Number(unitValueCentsRaw) || 0)
	const unitCostCents = Math.max(0, Number(unitCostCentsRaw) || 0)

	const desc = String(item?.description || '').trim()

	return {
		id: stableServiceId(index, item),
		kind,
		description: desc,
		quantity,
		value: unitValueCents ? formatMoneyInputBr(String(unitValueCents)) : '',
		cost: unitCostCents ? formatMoneyInputBr(String(unitCostCents)) : '',
		sourceProductId: item?.sourceProductId ? String(item.sourceProductId).trim() : null,
	}
}

type FormikServicesProps = {
	services: ServiceLine[]
	onAdd: (item: ServiceLine) => void
	onRemove: (index: number) => void
	onUpdate: (index: number, field: keyof Pick<ServiceLine, 'description' | 'value' | 'cost' | 'quantity'>, value: string) => void
	/** Chamado no blur dos campos para sincronizar a lista com o Formik (evita re-render a cada tecla). */
	onBlurSync?: (services: ServiceLine[]) => void
}

type OrderServicesCardProps = {
	/** Serviços iniciais (do banco). Usado na edição com form nativo. */
	initialServices?: ServiceItemDb[] | null
	/** Nome do input hidden para enviar servicesJson no form. Se não informado, não renderiza o input. */
	inputName?: string
	/** Id do form para associar o input. */
	formId?: string
	/** Modo Formik: usa services e callbacks em vez de estado interno. */
	formik?: FormikServicesProps
	/** Desabilita edição (ex.: ordem finalizada). */
	disabled?: boolean
	/** Abre a modal avançada inicialmente (usado para deep-link da listagem). */
	advancedInitiallyOpen?: boolean
	/** Status atual da OS (usado em regras da edição). */
	currentStatus?: string
	/** Campo hidden do form que guarda o status, para ajustes automáticos. */
	statusInputName?: string
}

export type OrderServicesCardRef = {
	syncToFormik: () => void
}

export const OrderServicesCard = forwardRef<OrderServicesCardRef | null, OrderServicesCardProps>(function OrderServicesCard({
	initialServices = [],
	inputName = 'servicesJson',
	formId,
	formik,
	disabled = false,
	advancedInitiallyOpen = false,
	currentStatus,
	statusInputName,
}, ref) {
	const [internalServices, setInternalServices] = useState<ServiceLine[]>(() => {
		if (formik && Array.isArray(formik.services)) {
			return formik.services.map((s) => ({ ...s }))
		}
		const items = Array.isArray(initialServices) ? initialServices : []
		return items.map((it, idx) => dbToLine(it, idx))
	})
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(advancedInitiallyOpen)
	const [isPickerVisible, setIsPickerVisible] = useState(false)
	const [isPickerOpen, setIsPickerOpen] = useState(false)
	const [catalogQuery, setCatalogQuery] = useState('')
	const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
	const [isCatalogLoading, setIsCatalogLoading] = useState(false)
	const [catalogError, setCatalogError] = useState<string | null>(null)
	const [resolvedStatus, setResolvedStatus] = useState(String(currentStatus || '').trim())

	const services = internalServices

	const appendLine = useCallback((line: ServiceLine) => {
		if (formik) formik.onAdd(line)
		setInternalServices((prev) => prev.concat(line))
	}, [formik])

	const addCatalogItem = useCallback((item: CatalogItem) => {
		const isOutOfStockProduct = item.kind === 'product' && Number(item.currentStock ?? 0) <= 0
		if (resolvedStatus === 'aprovado' && isOutOfStockProduct) {
			const shouldSwitch = window.confirm(
				'Este produto está com estoque 0. Deseja alterar a OS para "Aguardando peças"?',
			)
			if (shouldSwitch && statusInputName && formId) {
				const input = document.querySelector(
					`input[name="${statusInputName}"][form="${formId}"]`,
				) as HTMLInputElement | null
				if (input) input.value = 'aguardando_pecas'
				setResolvedStatus('aguardando_pecas')
			}
		}
		appendLine({
			id: makeServiceId(),
			kind: item.kind,
			description: item.name,
			quantity: '1',
			value: item.salePriceCents > 0 ? formatMoneyInputBr(String(item.salePriceCents)) : '',
			cost: item.costPriceCents > 0 ? formatMoneyInputBr(String(item.costPriceCents)) : '',
			sourceProductId: item.id,
		})
		setIsPickerVisible(false)
		setIsPickerOpen(false)
		setCatalogQuery('')
		setCatalogItems([])
		setCatalogError(null)
	}, [appendLine, formId, resolvedStatus, statusInputName])

	const removeInternal = useCallback((idx: number) => {
		setInternalServices((prev) => prev.filter((_, i) => i !== idx))
	}, [])

	const updateInternal = useCallback(
		(index: number, field: keyof Pick<ServiceLine, 'description' | 'value' | 'cost' | 'quantity'>, value: string) => {
			setInternalServices((prev) => {
				const next = [...prev]
				if (index >= 0 && index < next.length) next[index] = { ...next[index], [field]: value }
				return next
			})
		},
		[],
	)

	const handleRemove = formik
		? (idx: number) => {
			formik.onRemove(idx)
			setInternalServices((prev) => prev.filter((_, i) => i !== idx))
		}
		: removeInternal

	const handleUpdate = formik ? updateInternal : updateInternal

	const servicesNormalized = services
		.map((s) => {
			const kind = s.kind === 'product' ? 'product' : 'service'
			const description = String(s.description || '').trim()
			const quantityRaw =
				kind === 'product'
					? Number.parseInt(String(s.quantity || '1'), 10)
					: 1
			const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.min(9999, Math.max(1, quantityRaw)) : 1
			const unitValueCents = parseMoneyToCents(s.value)
			const unitCostCents = parseMoneyToCents(s.cost)
			const valueCents = unitValueCents * quantity
			const costCents = unitCostCents * quantity

			return {
				kind,
				description,
				quantity,
				unitValueCents,
				unitCostCents,
				valueCents,
				costCents,
				sourceProductId: s.sourceProductId ? String(s.sourceProductId).trim() : null,
			}
		})
		.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)

	const totalValueCents = servicesNormalized.reduce((acc, s) => acc + s.valueCents, 0)
	const totalCostCents = servicesNormalized.reduce((acc, s) => acc + s.costCents, 0)
	const netCents = totalValueCents - totalCostCents
	const marginPercent = totalValueCents > 0 ? (netCents / totalValueCents) * 100 : 0

	const servicesTotalCtx = useOrderServicesTotal()
	const totalValueCentsRef = useRef(totalValueCents)
	totalValueCentsRef.current = totalValueCents

	const syncTotalOnBlur = useCallback(() => {
		servicesTotalCtx?.setTotalValueCents(totalValueCentsRef.current)
	}, [servicesTotalCtx])

	// No blur: só atualiza o total no rodapé (contexto). Formik é sincronizado apenas no submit (criação).
	const syncOnBlur = useCallback(() => {
		syncTotalOnBlur()
	}, [syncTotalOnBlur])

	useImperativeHandle(ref, () => ({
		syncToFormik: () => {
			if (formik?.onBlurSync) formik.onBlurSync(internalServices)
		},
	}), [formik, internalServices])

	// Quando o Formik é reinicializado (ex.: ordem duplicada), sincroniza formik -> estado interno
	const formikServicesLength = formik?.services?.length ?? 0
	useEffect(() => {
		if (formik && formikServicesLength !== internalServices.length) {
			setInternalServices(formik.services.map((s) => ({ ...s })))
		}
	}, [formikServicesLength, internalServices.length, formik])

	// Atualiza o total no rodapé quando itens são adicionados ou removidos (não a cada digitação)
	useEffect(() => {
		if (servicesTotalCtx) {
			servicesTotalCtx.setTotalValueCents(totalValueCentsRef.current)
		}
	}, [services.length, servicesTotalCtx])

	useEffect(() => {
		const trimmed = catalogQuery.trim()
		if (!isPickerVisible) {
			setCatalogItems([])
			setCatalogError(null)
			setIsCatalogLoading(false)
			return
		}
		if (trimmed.length < 3) {
			setCatalogItems([])
			setCatalogError(null)
			setIsCatalogLoading(false)
			return
		}

		let cancelled = false
		const controller = new AbortController()
		const timeoutId = setTimeout(async () => {
			setIsCatalogLoading(true)
			setCatalogError(null)
			try {
				const qs = new URLSearchParams()
				qs.set('q', trimmed)
				const response = await fetch(`/api/portal/produtos/search?${qs.toString()}`, {
					signal: controller.signal,
				})
				const data = await response.json().catch(() => null)
				if (cancelled) return
				if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
					setCatalogError(data?.error || 'Não foi possível carregar os itens cadastrados.')
					setCatalogItems([])
					return
				}
				setCatalogItems(data.items as CatalogItem[])
			} catch (err: unknown) {
				if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
				setCatalogError('Não foi possível carregar os itens cadastrados.')
				setCatalogItems([])
			} finally {
				if (!cancelled) setIsCatalogLoading(false)
			}
		}, 250)

		return () => {
			cancelled = true
			controller.abort()
			clearTimeout(timeoutId)
		}
	}, [catalogQuery, isPickerVisible])

	useEffect(() => {
		setResolvedStatus(String(currentStatus || '').trim())
	}, [currentStatus])

	const servicesJson = JSON.stringify({
		items: servicesNormalized,
		totals: { totalValueCents, totalCostCents },
	})

	return (
		<Card>
			<CardHeader className="space-y-1 p-5 pb-3">
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div className="min-w-0">
						<CardTitle>Serviços a realizar</CardTitle>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => setIsAdvancedOpen(true)}
						disabled={services.length === 0}
						title="Ver custos e margem"
						aria-label="Ver custos e margem"
					>
						<Settings className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 p-5 pt-0">
				{services.length > 0 ? (
					<div className="space-y-3">
						<div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
							<div className="md:col-span-7">Descrição</div>
							<div className="md:col-span-2">Qtd.</div>
							<div className="md:col-span-2">Valor</div>
							<div className="md:col-span-1 text-right">Ações</div>
						</div>
						{services.map((s, idx) => (
							<div key={s.id} className="grid gap-3 md:grid-cols-12 items-end">
								<div className={cn('space-y-1', s.kind === 'product' ? 'md:col-span-7' : 'md:col-span-9')}>
									<Label htmlFor={`service-description-${s.id}`} className="md:hidden">Descrição</Label>
									<Input
										id={`service-description-${s.id}`}
										value={s.description}
										readOnly
										placeholder={
											s.kind === 'product'
												? 'Ex: Tela iPhone 13 original...'
												: 'Ex: Troca de tela, diagnóstico, limpeza...'
										}
										disabled
									/>
								</div>
								{s.kind === 'product' ? (
									<div className="md:col-span-2 space-y-1">
										<Label htmlFor={`service-qty-${s.id}`} className="md:hidden">Qtd.</Label>
										<Input
											id={`service-qty-${s.id}`}
											value={s.quantity}
											onChange={(e) => handleUpdate(idx, 'quantity', e.target.value.replace(/\D/g, '').slice(0, 4))}
											onBlur={syncOnBlur}
											inputMode="numeric"
											placeholder="1"
											disabled={disabled}
										/>
									</div>
								) : null}
								<div className="md:col-span-2 space-y-1">
									<Label htmlFor={`service-value-${s.id}`} className="md:hidden">Valor</Label>
									<Input
										id={`service-value-${s.id}`}
										value={s.value}
										onChange={(e) => handleUpdate(idx, 'value', formatMoneyInputBr(e.target.value))}
										onBlur={syncOnBlur}
										inputMode="numeric"
										placeholder="0,00"
										disabled={disabled}
									/>
								</div>
								<div className="md:col-span-1 flex justify-end">
									<div className="flex items-center gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => handleRemove(idx)}
											disabled={disabled}
											title="Remover item"
											aria-label="Remover item"
											className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
								{idx !== services.length - 1 ? <div className="md:col-span-12 border-t" /> : null}
							</div>
						))}
					</div>
				) : null}

				{isPickerVisible ? (
					<div className="grid gap-3 md:grid-cols-12 items-end rounded-md border border-dashed p-3">
						<div className="md:col-span-10 space-y-1">
							<Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
								<PopoverTrigger asChild>
									<button
										id="service-picker-trigger"
										type="button"
										disabled={disabled}
										className={cn(
											'w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left',
											'hover:bg-accent/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
										)}
									>
										<span className={cn(!catalogQuery ? 'text-muted-foreground' : '')}>
											{catalogQuery || 'Buscar produto/serviço (mín. 3 caracteres)'}
										</span>
										<ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
									</button>
								</PopoverTrigger>
								<PopoverContent className="p-0 w-[min(640px,calc(100vw-2rem))]" align="start">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder="Digite nome, SKU ou código..."
											value={catalogQuery}
											onValueChange={setCatalogQuery}
										/>
										<CommandList>
											{catalogQuery.trim().length < 3 ? (
												<CommandEmpty>Digite ao menos 3 caracteres para buscar.</CommandEmpty>
											) : isCatalogLoading ? (
												<div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
													<Loader2 className="h-4 w-4 animate-spin" />
													Carregando itens...
												</div>
											) : catalogError ? (
												<CommandEmpty>{catalogError}</CommandEmpty>
											) : catalogItems.length === 0 ? (
												<CommandEmpty>Nenhum item encontrado.</CommandEmpty>
											) : (
											catalogItems.map((item) => {
													const currentStock = Number(item.currentStock ?? 0)
													const hasImage = Boolean(item.imageUrl)
												const isParentWithVariations =
													item.kind === 'product' && item.hasVariations === true
												const isVariation = item.isVariation === true
													return (
														<CommandItem
															key={item.id}
															value={`${item.name} ${item.sku || ''} ${item.barcode || ''}`}
															onSelect={() => addCatalogItem(item)}
														disabled={isParentWithVariations}
															className="gap-3 rounded-md px-3 py-2.5 data-[selected=true]:bg-muted/50 data-[selected=true]:text-foreground"
														>
															<Check className="hidden" />
														<div
															className={cn(
																'relative flex items-center gap-3',
																isVariation && 'pl-3',
															)}
														>
															{isVariation ? (
																<span
																	className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-border"
																	aria-hidden="true"
																/>
															) : null}
															<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
																{hasImage ? (
																	<img
																		src={String(item.imageUrl)}
																		alt=""
																		className="h-full w-full object-cover"
																	/>
																) : (
																	<span className="text-[10px] uppercase text-muted-foreground">
																		{item.kind === 'product' ? 'Produto' : 'Serviço'}
																	</span>
																)}
															</div>
														</div>
														<div className="min-w-0 flex-1">
																<div className="flex items-center gap-2">
																	<span className="truncate font-medium">{item.name}</span>
																	<span
																		className={cn(
																			'inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
																			item.kind === 'product'
																				? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
																				: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
																		)}
																	>
																		{item.kind === 'product' ? 'Produto' : 'Serviço'}
																	</span>
																{isParentWithVariations ? (
																	<span className="text-[11px] text-muted-foreground">
																		Selecione uma variação
																	</span>
																) : null}
																</div>
															{!isParentWithVariations ? (
																<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
																	<span>SKU: {item.sku || '-'}</span>
																	<span>Venda: {formatCentsBr(item.salePriceCents)}</span>
																	{item.kind === 'product' ? (
																		<span
																			className={cn(
																				currentStock <= 0 && 'text-amber-700 dark:text-amber-300',
																			)}
																		>
																			Estoque: {currentStock}
																		</span>
																	) : null}
																</div>
															) : null}
															</div>
														</CommandItem>
													)
												})
											)}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
						<div className="md:col-span-2 flex justify-end">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => {
									setIsPickerVisible(false)
									setIsPickerOpen(false)
									setCatalogQuery('')
									setCatalogItems([])
									setCatalogError(null)
								}}
								disabled={disabled}
								title="Remover inclusão"
								aria-label="Remover inclusão"
								className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				) : null}

				{services.length > 0 ? (
					<div className="flex justify-end border-t pt-3 text-sm">
						<span className="text-muted-foreground">Valor total: </span>
						<span className="font-medium ml-1">{formatCentsBr(totalValueCents)}</span>
					</div>
				) : null}

				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => {
						setIsPickerVisible(true)
						setIsPickerOpen(true)
					}}
					disabled={disabled || isPickerVisible}
				className="w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800"
				>
					<Plus className="h-4 w-4 mr-2" />
					Incluir serviço ou produto
				</Button>

				{inputName ? (
					<input
						type="hidden"
						name={inputName}
						value={servicesJson}
						form={formId}
						readOnly
						aria-hidden
					/>
				) : null}

				<Dialog open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>Serviços e produtos</DialogTitle>
							<DialogDescription>
								Revise os valores de venda, custos e a margem desta ordem.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3 overflow-y-auto pr-1">
							{services.map((s, idx) => {
								const isProduct = s.kind === 'product'

								return (
									<div
										key={s.id}
										className="rounded-md border border-border bg-card p-3 space-y-2 text-sm"
									>
										<div className='grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2 md:items-end'>
											<div className="flex gap-2">
												<div className="flex-1 min-w-0 space-y-1">
													<Label htmlFor={`adv-desc-${s.id}`}>Descrição</Label>
													<Input
														id={`adv-desc-${s.id}`}
														value={s.description}
														readOnly
														placeholder="Descrição"
														disabled
													/>
												</div>
												{isProduct ? (
													<div className="w-16 shrink-0 space-y-1 md:min-w-0">
														<Label htmlFor={`adv-qty-${s.id}`}>Qtd.</Label>
														<Input
															id={`adv-qty-${s.id}`}
															value={s.quantity}
															onChange={(e) =>
																handleUpdate(
																	idx,
																	'quantity',
																	e.target.value.replace(/\D/g, '').slice(0, 4),
																)
															}
															onBlur={syncOnBlur}
															inputMode="numeric"
															placeholder="1"
															disabled={disabled}
															className="md:w-full"
														/>
													</div>
												) : null}
											</div>

											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-1 min-w-0">
													<Label htmlFor={`adv-value-${s.id}`}>Valor unitário</Label>
													<Input
														id={`adv-value-${s.id}`}
														value={s.value}
														onChange={(e) =>
															handleUpdate(
																idx,
																'value',
																formatMoneyInputBr(e.target.value),
															)
														}
														onBlur={syncOnBlur}
														inputMode="numeric"
														placeholder="0,00"
														disabled={disabled}
													/>
												</div>
												<div className="space-y-1 min-w-0">
													<Label htmlFor={`adv-cost-${s.id}`}>Custo unitário</Label>
													<Input
														id={`adv-cost-${s.id}`}
														value={s.cost}
														onChange={(e) =>
															handleUpdate(
																idx,
																'cost',
																formatMoneyInputBr(e.target.value),
															)
														}
														onBlur={syncOnBlur}
														inputMode="numeric"
														placeholder="0,00"
														disabled={disabled}
													/>
												</div>
											</div>
										</div>
									</div>
								)
							})}
						</div>

						<div className="flex flex-wrap items-center justify-end gap-4 text-xs">
							<div>
								<span className="text-muted-foreground">Valor total: </span>
								<span className="font-medium">
									{formatCentsBr(totalValueCents)}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground">Custo total: </span>
								<span className="font-medium">
									{formatCentsBr(totalCostCents)}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground">Margem: </span>
								<span className="font-medium">
									{formatCentsBr(netCents)} ({marginPercent.toFixed(1)}%)
								</span>
							</div>
						</div>


						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsAdvancedOpen(false)}
							>
								Fechar
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

			</CardContent>
		</Card>
	)
})
