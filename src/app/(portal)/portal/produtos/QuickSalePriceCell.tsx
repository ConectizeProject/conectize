'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { QuickPriceEditor } from './QuickPriceEditor'

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
	const router = useRouter()

	async function persistSalePrice (cents: number | null) {
		if (cents === null) {
			toast({ description: 'Informe um valor válido', variant: 'destructive' })
			return false
		}

		try {
			const response = await fetch(`/api/portal/produtos/${productId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					salePrice: cents / 100,
					syncToBling: Boolean(blingId),
				}),
			})

			const data = await response.json().catch(() => null)
			if (!response.ok) {
				toast({
					description: data?.message || data?.error || 'Erro ao salvar preço',
					variant: 'destructive',
				})
				return false
			}

			if (blingId && data?.syncedToBling !== true) {
				toast({
					title: 'Preço salvo no portal',
					description: data?.message || data?.syncError || 'Falha ao sincronizar com o Bling. O item ficou pendente de sincronização.',
					variant: 'destructive',
				})
			} else if (blingId) {
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

			router.refresh()
			return true
		} catch {
			toast({ description: 'Erro ao salvar preço', variant: 'destructive' })
			return false
		}
	}

	return (
		<QuickPriceEditor
			valueCents={salePriceCents}
			align={align}
			emptyLabel="-"
			editAriaLabel="Editar preço de venda"
			applyingAriaLabel="Aplicando preço de venda"
			onCommit={persistSalePrice}
		/>
	)
})
