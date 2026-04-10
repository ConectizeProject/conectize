'use client'

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import {
	commissionFromPercentOfGrossCents,
	grossProfitBeforeCommissionCents,
	paymentFeeCentsForSaleEntries,
} from '@/lib/resale/resale-commission'
import { isSaleDerivedCostDescription } from '@/lib/resale/resale-sale-costs'

export type SellCommissionInitial = {
	enabled: boolean
	userId: string
	kind: 'percent' | 'fixed'
	percentRaw: string
	fixedMasked: string
}

export type SellCommissionSnapshot = SellCommissionInitial

export type ResaleSellCommissionPanelRef = {
	getValues: () => SellCommissionSnapshot
}

type TeamUser = { id: string; email: string | null; full_name: string | null; role: string }

type SalePaymentEntry = {
	payment_method_id: string
	value_cents: number | null
	installments: number
}

type PaymentMethod = {
	id: string
	description: string
	type: string
	fee_percent: number
	credit_installment_fees: Array<{ installments: number; fee_percent: number }>
}

type DeviceSlice = {
	purchase_value_cents: number | null
	costs: Array<{ description: string | null; value_cents: number }>
}

type Props = {
	device: DeviceSlice
	sellPaymentMethods: SalePaymentEntry[]
	paymentMethods: PaymentMethod[]
	teamUsers: TeamUser[]
	initial: SellCommissionInitial
}

export const ResaleSellCommissionPanel = forwardRef<ResaleSellCommissionPanelRef, Props>(
	function ResaleSellCommissionPanel (
		{ device, sellPaymentMethods, paymentMethods, teamUsers, initial },
		ref
	) {
		const [enabled, setEnabled] = useState(initial.enabled)
		const [userId, setUserId] = useState(initial.userId)
		const [kind, setKind] = useState<'percent' | 'fixed'>(initial.kind)
		const [percentRaw, setPercentRaw] = useState(initial.percentRaw)
		const [fixedMasked, setFixedMasked] = useState(initial.fixedMasked)

		useImperativeHandle(ref, () => ({
			getValues: () => ({
				enabled,
				userId: userId.trim(),
				kind,
				percentRaw,
				fixedMasked,
			}),
		}), [enabled, userId, kind, percentRaw, fixedMasked])

		const percentHint = useMemo(() => {
			if (kind !== 'percent') return null
			const p = Number.parseFloat(percentRaw.replace(',', '.'))
			if (!Number.isFinite(p) || p <= 0) return null
			const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
			let sum = 0
			for (const e of valid) {
				const v = e.value_cents
				if (v == null || v <= 0) return null
				sum += v
			}
			if (sum <= 0) return null
			const purchaseCents = device.purchase_value_cents ?? 0
			const baseOperationalCents = (device.costs || []).reduce(
				(acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
				0
			)
			const fee = paymentFeeCentsForSaleEntries(valid, paymentMethods)
			const gross = grossProfitBeforeCommissionCents(sum, purchaseCents, baseOperationalCents, fee)
			const commissionCents = commissionFromPercentOfGrossCents(gross, p)
			return { commissionCents, grossCents: gross }
		}, [kind, percentRaw, sellPaymentMethods, device, paymentMethods])

		const profitFooter = useMemo(() => {
			const validPreview = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
			let totalCents = 0
			let hasTotal = true
			for (const e of validPreview) {
				const v = e.value_cents
				if (v == null || v <= 0) {
					hasTotal = false
					break
				}
				totalCents += v
			}
			if (validPreview.length === 0) hasTotal = false

			const purchaseCents = device.purchase_value_cents ?? 0
			const baseOperationalCents = (device.costs || []).reduce(
				(acc, c) => acc + (isSaleDerivedCostDescription(c.description) ? 0 : (c.value_cents ?? 0)),
				0
			)
			const paymentFeePreviewCents = paymentFeeCentsForSaleEntries(validPreview, paymentMethods)

			let commPreview = 0
			if (hasTotal && enabled && userId.trim()) {
				if (kind === 'percent') {
					const p = Number.parseFloat(percentRaw.replace(',', '.'))
					const gross = grossProfitBeforeCommissionCents(
						totalCents,
						purchaseCents,
						baseOperationalCents,
						paymentFeePreviewCents
					)
					commPreview = commissionFromPercentOfGrossCents(gross, p)
				} else {
					commPreview = moneyToCentsFromMasked(fixedMasked) ?? 0
				}
			}

			const costsCents = baseOperationalCents + paymentFeePreviewCents + commPreview
			const lucroCents = hasTotal ? totalCents - purchaseCents - costsCents : null

			return { totalCents, hasTotal, lucroCents }
		}, [
			sellPaymentMethods,
			device,
			paymentMethods,
			enabled,
			userId,
			kind,
			percentRaw,
			fixedMasked,
		])

		return (
			<>
				<div className="space-y-3 rounded-md border p-3">
					<div className="flex items-center space-x-2">
						<Checkbox
							id="sell-commission"
							checked={enabled}
							onCheckedChange={(v) => setEnabled(v === true)}
						/>
						<Label htmlFor="sell-commission" className="font-normal cursor-pointer leading-snug">
							Comissão (descontada do lucro da venda)
						</Label>
					</div>
					{enabled ? (
						<div className="grid gap-3 sm:grid-cols-2 pl-6 border-t pt-3">
							<div className="space-y-1 sm:col-span-2">
								<Label className="text-xs">Colaborador (staff / admin)</Label>
								<Select
									value={userId || '__none__'}
									onValueChange={(v) => setUserId(v === '__none__' ? '' : v)}
								>
									<SelectTrigger className="h-9">
										<SelectValue placeholder="Selecione..." />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__none__">Selecione…</SelectItem>
										{teamUsers.map((u) => (
											<SelectItem key={u.id} value={u.id}>
												{(u.full_name || '').trim() || u.email || u.id}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label className="text-xs">Tipo de comissão</Label>
								<RadioGroup
									value={kind}
									onValueChange={(v: 'percent' | 'fixed') => setKind(v)}
									className="flex flex-wrap gap-4"
								>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="percent" id="comm-pct" />
										<Label htmlFor="comm-pct" className="font-normal cursor-pointer">
											Percentual sobre o lucro bruto
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="fixed" id="comm-fix" />
										<Label htmlFor="comm-fix" className="font-normal cursor-pointer">
											Valor fixo (R$)
										</Label>
									</div>
								</RadioGroup>
							</div>
							<div className="space-y-1 sm:col-span-2">
								{kind === 'percent' ? (
									<>
										<Label className="text-xs">Percentual sobre o lucro bruto (%)</Label>
										<Input
											value={percentRaw}
											onChange={(e) => setPercentRaw(e.target.value.replace(/[^0-9,.-]/g, ''))}
											placeholder="Ex: 2,5"
											className="h-9"
										/>
										{percentHint ? (
											<div className="pt-0.5 space-y-0.5">
												<p className="text-xs text-green-600 dark:text-green-400 font-medium">
													Comissão: R$ {maskedFromCents(percentHint.commissionCents)}
												</p>
												{percentHint.grossCents <= 0 ? (
													<p className="text-xs text-muted-foreground">
														Lucro bruto (venda − compra − custos − taxa) não é positivo; comissão percentual = R$ 0,00.
													</p>
												) : null}
											</div>
										) : null}
									</>
								) : (
									<>
										<Label className="text-xs">Valor (R$)</Label>
										<Input
											value={fixedMasked}
											onChange={(e) => setFixedMasked(formatMoneyInput(e.target.value))}
											placeholder="0,00"
											className="h-9"
										/>
									</>
								)}
							</div>
						</div>
					) : null}
				</div>

				<div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
					{profitFooter.hasTotal ? (
						<p className="text-sm text-muted-foreground">
							Total da venda (soma dos pagamentos):{' '}
							<span className="font-medium text-foreground">R$ {maskedFromCents(profitFooter.totalCents)}</span>
						</p>
					) : (
						<p className="text-sm text-muted-foreground">Preencha os valores em cada forma de pagamento para ver o total e o lucro.</p>
					)}
					<div>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lucro real estimado</p>
						<p
							className={`text-lg font-bold ${
								profitFooter.lucroCents != null
									? profitFooter.lucroCents >= 0
										? 'text-green-600 dark:text-green-400'
										: 'text-red-600 dark:text-red-400'
									: ''
							}`}
						>
							{profitFooter.lucroCents != null ? `R$ ${maskedFromCents(profitFooter.lucroCents)}` : '-'}
						</p>
					</div>
				</div>
			</>
		)
	}
)
