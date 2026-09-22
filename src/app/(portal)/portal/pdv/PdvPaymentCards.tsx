'use client'

import { AlertCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatMoneyInput, maskedFromCents } from '@/lib/utils/money'
import { maxCreditInstallments } from './pdv-helpers'
import type { PaymentLine, PaymentMethod } from './pdv-types'

type MethodGroupId = 'dinheiro' | 'pix' | 'debito' | 'credito'

const METHOD_GROUPS: { id: MethodGroupId; label: string; types: PaymentMethod['type'][] }[] = [
	{ id: 'dinheiro', label: 'Dinheiro', types: ['dinheiro'] },
	{ id: 'pix', label: 'Pix', types: ['pix_direto', 'pix_maquina'] },
	{ id: 'debito', label: 'Débito', types: ['debito'] },
	{ id: 'credito', label: 'Crédito', types: ['credito'] },
]

const VARIANT_LABELS: Record<PaymentMethod['type'], string> = {
	dinheiro: 'Dinheiro',
	pix_direto: 'PIX direto',
	pix_maquina: 'PIX máquina',
	debito: 'Débito',
	credito: 'Crédito',
}

const NO_ACCOUNT_KEY = '__none__'

type AccountOption = {
	key: string
	name: string
	methods: PaymentMethod[]
}

type PendingChoice = {
	group: MethodGroupId
	accountKey?: string
}

type Props = {
	payments: PaymentLine[]
	paymentMethods: PaymentMethod[]
	disabled: boolean
	paidCents: number
	totalCents: number
	onSelectMethod: (idx: number, methodId: string | null) => void
	onSelectInstallments: (idx: number, installments: number) => void
	onAmountChange: (idx: number, amountMasked: string) => void
	onAmountBlur: (idx: number) => void
	onRemove: (idx: number) => void
	onAdd: () => void
}

function accountKeyOf (method: PaymentMethod) {
	return method.conta_id || NO_ACCOUNT_KEY
}

function groupOfType (type: string): MethodGroupId | null {
	const group = METHOD_GROUPS.find((item) => (item.types as readonly string[]).includes(type))
	return group?.id ?? null
}

function methodsInGroup (methods: PaymentMethod[], groupId: MethodGroupId) {
	const types = METHOD_GROUPS.find((item) => item.id === groupId)?.types ?? []
	return methods
		.filter((method) => (types as readonly string[]).includes(method.type))
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function accountsForGroup (methods: PaymentMethod[], groupId: MethodGroupId): AccountOption[] {
	const grouped = new Map<string, AccountOption>()

	for (const method of methodsInGroup(methods, groupId)) {
		const key = accountKeyOf(method)
		const current = grouped.get(key)
		if (current) {
			current.methods.push(method)
			continue
		}
		grouped.set(key, {
			key,
			name: key === NO_ACCOUNT_KEY ? 'Sem conta' : (method.conta_name || 'Conta'),
			methods: [method],
		})
	}

	return [...grouped.values()].sort((a, b) => {
		if (a.key === NO_ACCOUNT_KEY) return 1
		if (b.key === NO_ACCOUNT_KEY) return -1
		const aOrder = Math.min(...a.methods.map((method) => method.sort_order ?? 0))
		const bOrder = Math.min(...b.methods.map((method) => method.sort_order ?? 0))
		if (aOrder !== bOrder) return aOrder - bOrder
		return a.name.localeCompare(b.name, 'pt-BR')
	})
}

function variantLabel (method: PaymentMethod, siblings: PaymentMethod[]) {
	const hasDuplicateType = siblings.filter((item) => item.type === method.type).length > 1
	if (hasDuplicateType && method.description.trim()) return method.description
	return VARIANT_LABELS[method.type] || method.description
}

function installmentOptions (method: PaymentMethod | undefined) {
	if (!method || method.type !== 'credito') return []
	const fees = Array.isArray(method.credit_installment_fees) ? method.credit_installment_fees : []
	if (fees.length > 0) {
		return [...fees]
			.map((fee) => Number(fee.installments) || 1)
			.sort((a, b) => a - b)
	}

	const max = maxCreditInstallments(method)
	return Array.from({ length: max }, (_, index) => index + 1)
}

function shiftPendingChoices (pending: Record<number, PendingChoice>, removedIdx: number) {
	const next: Record<number, PendingChoice> = {}
	for (const [key, value] of Object.entries(pending)) {
		const index = Number(key)
		if (index === removedIdx) continue
		next[index > removedIdx ? index - 1 : index] = value
	}
	return next
}

function choiceCardClass (selected: boolean, disabled: boolean) {
	return cn(
		'rounded-md border px-3 py-2 text-left text-sm transition-colors',
		'disabled:cursor-not-allowed disabled:opacity-60',
		selected
			? 'border-primary bg-primary text-primary-foreground'
			: 'border-border bg-background hover:bg-muted',
		disabled && !selected && 'hover:bg-background',
	)
}

export function PdvPaymentCards ({
	payments,
	paymentMethods,
	disabled,
	paidCents,
	totalCents,
	onSelectMethod,
	onSelectInstallments,
	onAmountChange,
	onAmountBlur,
	onRemove,
	onAdd,
}: Props) {
	const [pendingChoices, setPendingChoices] = useState<Record<number, PendingChoice>>({})
	const availableGroups = METHOD_GROUPS.filter((group) => methodsInGroup(paymentMethods, group.id).length > 0)
	const overpaid = paidCents > totalCents

	function applyAccount (idx: number, groupId: MethodGroupId, accountKey: string) {
		const account = accountsForGroup(paymentMethods, groupId).find((item) => item.key === accountKey)
		const methods = account?.methods ?? []
		setPendingChoices((prev) => ({ ...prev, [idx]: { group: groupId, accountKey } }))
		onSelectMethod(idx, methods.length === 1 ? methods[0].id : null)
	}

	function selectGroup (idx: number, groupId: MethodGroupId) {
		const line = payments[idx]
		const current = paymentMethods.find((method) => method.id === line?.payment_method_id)
		if (current && groupOfType(current.type) === groupId) return

		if (groupId === 'dinheiro') {
			const cashMethod = methodsInGroup(paymentMethods, 'dinheiro')[0]
			setPendingChoices((prev) => ({ ...prev, [idx]: { group: 'dinheiro' } }))
			onSelectMethod(idx, cashMethod?.id ?? null)
			return
		}

		const accounts = accountsForGroup(paymentMethods, groupId)
		if (accounts.length === 1) {
			applyAccount(idx, groupId, accounts[0].key)
			return
		}

		setPendingChoices((prev) => ({ ...prev, [idx]: { group: groupId } }))
		onSelectMethod(idx, null)
	}

	function selectAccount (idx: number, groupId: MethodGroupId, accountKey: string) {
		const line = payments[idx]
		const current = paymentMethods.find((method) => method.id === line?.payment_method_id)
		if (current && groupOfType(current.type) === groupId && accountKeyOf(current) === accountKey) return
		applyAccount(idx, groupId, accountKey)
	}

	function removeLine (idx: number) {
		setPendingChoices((prev) => shiftPendingChoices(prev, idx))
		onRemove(idx)
	}

	return (
		<div className="space-y-3">
			{paymentMethods.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Nenhuma forma de pagamento cadastrada.
				</p>
			) : (
				payments.map((line, idx) => {
					const selectedMethod = paymentMethods.find((method) => method.id === line.payment_method_id)
					const pending = pendingChoices[idx]
					const groupId = selectedMethod ? groupOfType(selectedMethod.type) : (pending?.group ?? null)
					const isCash = groupId === 'dinheiro'
					const accounts = groupId && !isCash ? accountsForGroup(paymentMethods, groupId) : []
					const accountKey = !isCash && selectedMethod
						? accountKeyOf(selectedMethod)
						: (pending?.accountKey ?? (accounts.length === 1 ? accounts[0].key : undefined))
					const variantMethods = accounts.find((account) => account.key === accountKey)?.methods ?? []
					const showVariants = !isCash && variantMethods.length > 1
					const installments = installmentOptions(selectedMethod)
					const selectedInstallments = Math.min(
						Math.max(1, line.installments || 1),
						installments.length > 0 ? Math.max(...installments) : 1,
					)

					return (
						<article key={idx} className="space-y-3 rounded-lg border p-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									{payments.length > 1 ? `Pagamento ${idx + 1}` : 'Pagamento'}
								</p>
								{payments.length > 1 ? (
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive hover:text-destructive"
										disabled={disabled}
										onClick={() => removeLine(idx)}
										aria-label={`Remover pagamento ${idx + 1}`}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								) : null}
							</div>

							<div className="space-y-1.5">
								<p className="text-xs text-muted-foreground">Método</p>
								<div className="flex flex-wrap gap-2">
									{availableGroups.map((group) => (
										<button
											key={group.id}
											type="button"
											disabled={disabled}
											aria-pressed={group.id === groupId}
											className={choiceCardClass(group.id === groupId, disabled)}
											onClick={() => selectGroup(idx, group.id)}
										>
											{group.label}
										</button>
									))}
								</div>
							</div>

							{groupId && !isCash ? (
								<div className="space-y-1.5">
									<p className="text-xs text-muted-foreground">Conta</p>
									<div className="flex flex-wrap gap-2">
										{accounts.map((account) => (
											<button
												key={account.key}
												type="button"
												disabled={disabled}
												aria-pressed={account.key === accountKey}
												className={choiceCardClass(account.key === accountKey, disabled)}
												onClick={() => selectAccount(idx, groupId, account.key)}
											>
												{account.name}
											</button>
										))}
									</div>
								</div>
							) : null}

							{showVariants ? (
								<div className="flex flex-wrap gap-2">
									{variantMethods.map((method) => (
										<button
											key={method.id}
											type="button"
											disabled={disabled}
											aria-pressed={method.id === line.payment_method_id}
											className={choiceCardClass(method.id === line.payment_method_id, disabled)}
											onClick={() => onSelectMethod(idx, method.id)}
										>
											{variantLabel(method, variantMethods)}
										</button>
									))}
								</div>
							) : null}

							{installments.length > 0 ? (
								<div className="space-y-1.5">
									<p className="text-xs text-muted-foreground">Parcelas</p>
									<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
										{installments.map((installment) => {
											const selected = installment === selectedInstallments
											return (
												<button
													key={installment}
													type="button"
													disabled={disabled}
													aria-pressed={selected}
													className={cn(choiceCardClass(selected, disabled), 'px-2 py-1.5 text-center')}
													onClick={() => onSelectInstallments(idx, installment)}
												>
													{installment}x
												</button>
											)
										})}
									</div>
								</div>
							) : null}

							<div>
								<Label htmlFor={`pdv-payment-amount-${idx}`}>Valor</Label>
								<Input
									id={`pdv-payment-amount-${idx}`}
									className="mt-1"
									value={line.amountMasked}
									onChange={(event) => onAmountChange(idx, formatMoneyInput(event.target.value))}
									onBlur={() => onAmountBlur(idx)}
									placeholder="0,00"
									disabled={disabled}
								/>
							</div>
						</article>
					)
				})
			)}

			<Button variant="outline" size="sm" disabled={disabled || paymentMethods.length === 0} onClick={onAdd}>
				Adicionar pagamento
			</Button>

			{!disabled ? (
				<div
					className={cn(
						'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
						overpaid
							? 'border-destructive/50 bg-destructive/5 text-destructive'
							: 'border-border bg-muted/30 text-foreground',
					)}
				>
					<span className="inline-flex items-center gap-1.5 font-medium">
						{overpaid ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden /> : null}
						Total pago
					</span>
					<strong className="tabular-nums">{maskedFromCents(paidCents)}</strong>
				</div>
			) : null}
		</div>
	)
}
