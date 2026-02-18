'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	parseMoneyToCents,
	formatCentsBr,
	formatMoneyInputBr,
} from '@/lib/utils/format-money'

export type ServiceItemDb = {
	description?: string | null
	valueCents?: number | null
	costCents?: number | null
}

export type ServiceLine = {
	id: string
	description: string
	value: string
	cost: string
}

export function makeServiceId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return String(Date.now()) + String(Math.random()).slice(2)
}

function dbToLine(item: ServiceItemDb): ServiceLine {
	const valueCents = Math.max(0, Number(item?.valueCents) || 0)
	const costCents = Math.max(0, Number(item?.costCents) || 0)
	const desc = String(item?.description || '').trim()
	return {
		id: makeServiceId(),
		description: desc,
		value: valueCents ? formatMoneyInputBr(String(valueCents)) : '',
		cost: costCents ? formatMoneyInputBr(String(costCents)) : '',
	}
}

type FormikServicesProps = {
	services: ServiceLine[]
	onAdd: (item: ServiceLine) => void
	onRemove: (index: number) => void
	onUpdate: (index: number, field: keyof Pick<ServiceLine, 'description' | 'value' | 'cost'>, value: string) => void
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
}

export function OrderServicesCard({
	initialServices = [],
	inputName = 'servicesJson',
	formId,
	formik,
	disabled = false,
}: OrderServicesCardProps) {
	const [internalServices, setInternalServices] = useState<ServiceLine[]>(() => {
		const items = Array.isArray(initialServices) ? initialServices : []
		return items.map((it) => dbToLine(it))
	})

	const services = formik ? formik.services : internalServices

	const addInternal = useCallback(() => {
		setInternalServices((prev) =>
			prev.concat({ id: makeServiceId(), description: '', value: '', cost: '' })
		)
	}, [])
	const removeInternal = useCallback((idx: number) => {
		setInternalServices((prev) => prev.filter((_, i) => i !== idx))
	}, [])
	const updateInternal = useCallback(
		(index: number, field: keyof Pick<ServiceLine, 'description' | 'value' | 'cost'>, value: string) => {
			setInternalServices((prev) => {
				const next = [...prev]
				if (index >= 0 && index < next.length) next[index] = { ...next[index], [field]: value }
				return next
			})
		},
		[]
	)

	const handleAdd = formik ? () => formik.onAdd({ id: makeServiceId(), description: '', value: '', cost: '' }) : addInternal
	const handleRemove = formik ? formik.onRemove : removeInternal
	const handleUpdate = formik ? formik.onUpdate : updateInternal

	const servicesNormalized = services
		.map((s) => ({
			description: String(s.description || '').trim(),
			valueCents: parseMoneyToCents(s.value),
			costCents: parseMoneyToCents(s.cost),
		}))
		.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)

	const totalValueCents = servicesNormalized.reduce((acc, s) => acc + s.valueCents, 0)
	const totalCostCents = servicesNormalized.reduce((acc, s) => acc + s.costCents, 0)
	const servicesJson = JSON.stringify({
		items: servicesNormalized,
		totals: { totalValueCents, totalCostCents },
	})

	return (
		<div className="rounded-md border p-4 space-y-3">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<div className="text-sm font-medium">Serviços a realizar</div>
					<div className="text-xs text-muted-foreground">Adicione 1 ou mais serviços com valores.</div>
				</div>
			</div>

			<Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={disabled}>
				<Plus className="h-4 w-4 mr-2" />
				Adicionar serviço
			</Button>

			{services.length > 0 ? (
				<div className="space-y-3 mt-3">
					{services.map((s, idx) => (
						<div key={s.id} className="grid gap-3 md:grid-cols-12 items-end">
							<div className="md:col-span-6 space-y-1">
								<Label>Descrição</Label>
								<Input
									value={s.description}
									onChange={(e) => handleUpdate(idx, 'description', e.target.value)}
									placeholder="Ex: Troca de tela, diagnóstico, limpeza..."
									disabled={disabled}
								/>
							</div>
							<div className="md:col-span-2 space-y-1">
								<Label>Valor</Label>
								<Input
									value={s.value}
									onChange={(e) => handleUpdate(idx, 'value', formatMoneyInputBr(e.target.value))}
									inputMode="numeric"
									placeholder="0,00"
									disabled={disabled}
								/>
							</div>
							<div className="md:col-span-2 space-y-1">
								<Label>Valor de custo</Label>
								<Input
									value={s.cost}
									onChange={(e) => handleUpdate(idx, 'cost', formatMoneyInputBr(e.target.value))}
									inputMode="numeric"
									placeholder="0,00"
									disabled={disabled}
								/>
							</div>
							<div className="md:col-span-2 flex justify-end">
								<Button type="button" variant="outline" size="sm" onClick={() => handleRemove(idx)} disabled={disabled}>
									Remover
								</Button>
							</div>
							{idx !== services.length - 1 ? <div className="md:col-span-12 border-t" /> : null}
						</div>
					))}
				</div>
			) : null}

			{services.length > 0 ? (
				<div className="flex items-center justify-end gap-6 flex-wrap pt-2 border-t">
					<div className="text-sm">
						<span className="text-muted-foreground">Total serviços: </span>
						<span className="font-medium">{formatCentsBr(totalValueCents)}</span>
					</div>
					<div className="text-sm">
						<span className="text-muted-foreground">Total custo: </span>
						<span className="font-medium">{formatCentsBr(totalCostCents)}</span>
					</div>
					<div className="text-sm">
						<span className="text-muted-foreground">Resultado: </span>
						<span className="font-medium">{formatCentsBr(totalValueCents - totalCostCents)}</span>
					</div>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">Nenhum serviço adicionado ainda.</div>
			)}

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
		</div>
	)
}
