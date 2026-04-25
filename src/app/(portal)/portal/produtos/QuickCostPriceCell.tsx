'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'

type QuickCostPriceCellProps = {
	productId: string
	blingId?: string | null
	costPriceCents?: number | null
	/** Padrão: direita (células de tabela). Use `left` no card mobile. */
	align?: 'left' | 'right'
}

export const QuickCostPriceCell = memo(function QuickCostPriceCell ({
	productId,
	blingId,
	costPriceCents,
	align = 'right',
}: QuickCostPriceCellProps) {
	const justify = align === 'left' ? 'justify-start' : 'justify-end'
	const inputAlign = align === 'left' ? 'text-left' : 'text-right'
	const router = useRouter()
	const [isEditing, setIsEditing] = useState(false)
	const [value, setValue] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	async function handleSaveCost () {
		const raw = String(value).trim()
		let body: { costPrice: number | null }
		if (raw === '') {
			body = { costPrice: null }
		} else {
			const cents = moneyToCentsFromMasked(raw)
			if (cents === null || cents < 0) {
				toast({ description: 'Informe um valor válido (ex.: 0,00).', variant: 'destructive' })
				return
			}
			body = { costPrice: cents / 100 }
		}

		setIsSaving(true)

		try {
			const response = await fetch(`/api/portal/produtos/${productId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})

			const data = await response.json().catch(() => null)
			if (!response.ok) {
				toast({
					description: data?.message || data?.error || 'Erro ao salvar custo',
					variant: 'destructive',
				})
				return
			}

			if (blingId) {
				const syncResponse = await fetch(`/api/portal/produtos/${productId}/sync-bling`, {
					method: 'POST',
				})
				const syncData = await syncResponse.json().catch(() => null)

				if (!syncResponse.ok || !syncData?.ok) {
					toast({
						title: 'Custo salvo no portal',
						description: syncData?.message || syncData?.error || 'Falha ao sincronizar com o Bling. O item ficou pendente de sincronização.',
						variant: 'destructive',
					})
					setIsEditing(false)
					setValue('')
					router.refresh()
					return
				}

				toast({
					title: 'Custo salvo. Sincronização com o Bling concluída.',
					variant: 'success',
				})
			} else {
				toast({
					title: 'Custo salvo com sucesso.',
					variant: 'success',
				})
			}

			setIsEditing(false)
			setValue('')
			router.refresh()
		} catch {
			toast({ description: 'Erro ao salvar custo', variant: 'destructive' })
		} finally {
			setIsSaving(false)
		}
	}

	if (isEditing) {
		return (
			<div
				className={`flex items-center gap-1 ${justify}`}
				onClick={(event) => event.stopPropagation()}
			>
				<input
					type="text"
					inputMode="decimal"
					autoComplete="off"
					placeholder="0,00"
					className={`h-8 min-w-[6.5rem] max-w-[7.5rem] rounded border border-input bg-card px-2 text-xs ${inputAlign}`}
					value={value}
					onChange={(event) => setValue(formatMoneyInput(event.target.value))}
					title="Deixe vazio e confirme com OK para limpar o custo cadastrado"
					aria-label="Valor do custo em reais; vazio remove o custo"
				/>
				<Button
					type="button"
					variant="ghost"
					className="h-8 px-2 text-xs"
					disabled={isSaving}
					onClick={handleSaveCost}
				>
					{isSaving
						? (
							<>
								<Loader2 className="mr-1 h-3 w-3 animate-spin" />
								Salvando...
							</>
						)
						: 'OK'}
				</Button>
				<Button
					type="button"
					variant="ghost"
					className="h-8 px-2 text-xs"
					disabled={isSaving}
					onClick={() => {
						setIsEditing(false)
						setValue('')
					}}
				>
					X
				</Button>
			</div>
		)
	}

	return (
		<div
			className={`flex items-center gap-1 ${justify}`}
			onClick={(event) => event.stopPropagation()}
		>
			<span className="tabular-nums">
				{typeof costPriceCents === 'number'
					? formatCurrency(costPriceCents / 100)
					: '—'}
			</span>
			<button
				type="button"
				className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
				onClick={() => {
					setIsEditing(true)
					setValue(
						typeof costPriceCents === 'number'
							? maskedFromCents(costPriceCents)
							: '',
					)
				}}
				aria-label="Editar preço de custo"
				title="Editar preço de custo"
			>
				<Pencil className="h-3 w-3" />
			</button>
		</div>
	)
})
