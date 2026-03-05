'use client'

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useOrderServicesTotal } from './OrderServicesTotalContext'
import { Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	parseMoneyToCents,
	formatCentsBr,
	formatMoneyInputBr,
} from '@/lib/utils/format-money'
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
}

export type ServiceLine = {
	id: string
	kind: 'service' | 'product'
	description: string
	quantity: string
	value: string
	cost: string
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
}, ref) {
	const [internalServices, setInternalServices] = useState<ServiceLine[]>(() => {
		if (formik && Array.isArray(formik.services)) {
			return formik.services.map((s) => ({ ...s }))
		}
		const items = Array.isArray(initialServices) ? initialServices : []
		return items.map((it, idx) => dbToLine(it, idx))
	})
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(advancedInitiallyOpen)

	const services = internalServices

	const addInternalService = useCallback(() => {
		setInternalServices((prev) =>
			prev.concat({
				id: makeServiceId(),
				kind: 'service',
				description: '',
				quantity: '1',
				value: '',
				cost: '',
			}),
		)
	}, [])

	const addInternalProduct = useCallback(() => {
		setInternalServices((prev) =>
			prev.concat({
				id: makeServiceId(),
				kind: 'product',
				description: '',
				quantity: '1',
				value: '',
				cost: '',
			}),
		)
	}, [])

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

	const handleAddService = formik
		? () => {
				const item: ServiceLine = {
					id: makeServiceId(),
					kind: 'service',
					description: '',
					quantity: '1',
					value: '',
					cost: '',
				}
				formik.onAdd(item)
				setInternalServices((prev) => prev.concat(item))
			}
		: addInternalService

	const handleAddProduct = formik
		? () => {
				const item: ServiceLine = {
					id: makeServiceId(),
					kind: 'product',
					description: '',
					quantity: '1',
					value: '',
					cost: '',
				}
				formik.onAdd(item)
				setInternalServices((prev) => prev.concat(item))
			}
		: addInternalProduct

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

	const servicesJson = JSON.stringify({
		items: servicesNormalized,
		totals: { totalValueCents, totalCostCents },
	})

	return (
		<div className="rounded-md border p-4 space-y-3">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<div className="text-sm font-medium">Serviços a realizar</div>
					<div className="text-xs text-muted-foreground">
						Adicione serviços e produtos com os valores de venda.
					</div>
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

			{services.length > 0 ? (
				<div className="space-y-3 mt-3">
					{services.map((s, idx) => (
						<div key={s.id} className="grid gap-3 md:grid-cols-12 items-end">
							<div className="md:col-span-6 space-y-1">
								<Label htmlFor={`service-description-${s.id}`}>Descrição</Label>
								<Input
									id={`service-description-${s.id}`}
									value={s.description}
									onChange={(e) => handleUpdate(idx, 'description', e.target.value)}
									placeholder={
										s.kind === 'product'
											? 'Ex: Tela iPhone 13 original...'
											: 'Ex: Troca de tela, diagnóstico, limpeza...'
									}
									disabled={disabled}
								/>
							</div>
							{s.kind === 'product' ? (
								<div className="md:col-span-2 space-y-1">
									<Label htmlFor={`service-qty-${s.id}`}>Qtd.</Label>
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
							) : (
								<div className="md:col-span-2" />
							)}
							<div className="md:col-span-2 space-y-1">
								<Label htmlFor={`service-value-${s.id}`}>Valor</Label>
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
							<div className="md:col-span-2 flex justify-end">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => handleRemove(idx)}
									disabled={disabled}
								>
									Remover
								</Button>
							</div>
							{idx !== services.length - 1 ? <div className="md:col-span-12 border-t" /> : null}
						</div>
					))}
					<div className="flex justify-end border-t pt-3 mt-3 text-sm">
						<span className="text-muted-foreground">Valor total: </span>
						<span className="font-medium ml-1">{formatCentsBr(totalValueCents)}</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">
					Nenhum serviço adicionado ainda.
				</div>
			)}

			<div className="flex justify-end gap-2 pt-3 border-t mt-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleAddService}
					disabled={disabled}
				>
					<Plus className="h-4 w-4 mr-2" />
					Adicionar serviço
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleAddProduct}
					disabled={disabled}
				>
					<Plus className="h-4 w-4 mr-2" />
					Adicionar produto
				</Button>
			</div>

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
							const normalized = servicesNormalized[idx]
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
													onChange={(e) =>
														handleUpdate(idx, 'description', e.target.value)
													}
													placeholder="Descrição"
													disabled={disabled}
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
		</div>
	)
})
