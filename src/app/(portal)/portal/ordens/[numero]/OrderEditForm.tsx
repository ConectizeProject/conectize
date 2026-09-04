'use client'

import { type ReactNode, useActionState, useEffect, useRef } from 'react'
import { toast } from '@/hooks/use-toast'
import {
	type UpdateOrderSaveResult,
	updateOrderAction,
} from './order-detail-actions'

type OrderEditFormProps = {
	id: string
	formKey: string
	className?: string
	children: ReactNode
}

export function OrderEditForm({
	id,
	formKey,
	className,
	children,
}: OrderEditFormProps) {
	const [state, formAction] = useActionState<UpdateOrderSaveResult, FormData>(
		updateOrderAction,
		null,
	)
	const lastToastRef = useRef(0)

	useEffect(() => {
		if (!state?.ok) return
		const now = Date.now()
		if (now - lastToastRef.current < 500) return
		lastToastRef.current = now
		toast({
			variant: 'success',
			title: 'Dados salvos',
			description:
				'As alterações da ordem de serviço foram salvas com sucesso.',
		})
	}, [state])

	return (
		<form id={id} key={formKey} action={formAction} className={className}>
			{children}
		</form>
	)
}
