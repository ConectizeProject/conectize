'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { QuickPriceEditor } from './QuickPriceEditor'

type QuickCostPriceCellProps = {
	productId: string
	blingId?: string | null
	costPriceCents?: number | null
	/** Padrão: direita (células de tabela). Use `left` no card mobile. */
	align?: 'left' | 'right'
}

export const QuickCostPriceCell = memo(function QuickCostPriceCell ({
	productId,
	costPriceCents,
	align = 'right',
}: QuickCostPriceCellProps) {
	const router = useRouter()

	async function persistCostPrice (cents: number | null) {
		try {
			const response = await fetch(`/api/portal/produtos/${productId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					costPrice: cents === null ? null : cents / 100,
				}),
			})

			const data = await response.json().catch(() => null)
			if (!response.ok) {
				toast({
					description: data?.message || data?.error || 'Erro ao salvar custo',
					variant: 'destructive',
				})
				return false
			}

			toast({
				title: 'Custo salvo com sucesso.',
				variant: 'success',
			})

			router.refresh()
			return true
		} catch {
			toast({ description: 'Erro ao salvar custo', variant: 'destructive' })
			return false
		}
	}

	return (
		<QuickPriceEditor
			valueCents={costPriceCents}
			align={align}
			allowEmpty
			emptyLabel="—"
			editAriaLabel="Editar preço de custo"
			applyingAriaLabel="Aplicando preço de custo"
			onCommit={persistCostPrice}
		/>
	)
})
