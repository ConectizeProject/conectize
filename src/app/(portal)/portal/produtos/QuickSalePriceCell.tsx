'use client'

import { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

type QuickSalePriceCellProps = {
	productId: string
	blingId?: string | null
	salePriceCents?: number | null
	/** Padrão: direita (células de tabela). Use `left` no card mobile. */
	align?: 'left' | 'right'
}

export const QuickSalePriceCell = memo(function QuickSalePriceCell ({
	productId,
	blingId,
	salePriceCents,
	align = 'right',
}: QuickSalePriceCellProps) {
	const justify = align === 'left' ? 'justify-start' : 'justify-end'
	const inputAlign = align === 'left' ? 'text-left' : 'text-right'
	const router = useRouter()
	const [isEditing, setIsEditing] = useState(false)
	const [value, setValue] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	async function handleSavePrice () {
		const numericValue = Number(String(value).replace(',', '.'))
		if (!Number.isFinite(numericValue) || numericValue < 0) {
			toast({ description: 'Informe um valor válido', variant: 'destructive' })
			return
		}

		setIsSaving(true)

		try {
			const response = await fetch(`/api/portal/produtos/${productId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ salePrice: numericValue }),
			})

			const data = await response.json().catch(() => null)
			if (!response.ok) {
				toast({
					description: data?.message || data?.error || 'Erro ao salvar preço',
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
						title: 'Preço salvo no portal',
						description: syncData?.message || syncData?.error || 'Falha ao sincronizar com o Bling. O item ficou pendente de sincronização.',
						variant: 'destructive',
					})
					setIsEditing(false)
					setValue('')
					router.refresh()
					return
				}

				toast({
					title: 'Preço salvo e sincronizado com o Bling.',
					variant: 'success',
				})
			} else {
				toast({
					title: 'Preço salvo com sucesso.',
					variant: 'success',
				})
			}

			setIsEditing(false)
			setValue('')
			router.refresh()
		} catch {
			toast({ description: 'Erro ao salvar preço', variant: 'destructive' })
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
					type="number"
					step="0.01"
					min="0"
					className={`h-8 w-24 rounded border border-input bg-card px-2 text-xs ${inputAlign}`}
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
				<Button
					type="button"
					variant="ghost"
					className="h-8 px-2 text-xs"
					disabled={isSaving}
					onClick={handleSavePrice}
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
				{typeof salePriceCents === 'number'
					? formatCurrency(salePriceCents / 100)
					: '-'}
			</span>
			<button
				type="button"
				className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
				onClick={() => {
					setIsEditing(true)
					setValue(
						typeof salePriceCents === 'number'
							? (salePriceCents / 100).toFixed(2)
							: ''
					)
				}}
			>
				<Pencil className="h-3 w-3" />
			</button>
		</div>
	)
})
