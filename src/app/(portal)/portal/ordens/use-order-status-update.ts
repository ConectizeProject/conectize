'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { ORDER_STATUS_LABELS } from '@/lib/orders/order-status'
import { updateOrderStatusAction } from './[numero]/order-detail-actions'

export type OrderStatusBlockerDialogState = {
  orderId: string
  status: string
  exit: boolean
  warranty: boolean
}

export type UpdateOrderStatusExtraOptions = {
  confirmIncompleteExit?: boolean
  confirmFinalizeWithoutWarranty?: boolean
  /** Chamado após sucesso (ex.: invalidar colunas finais do Kanban). */
  onAfterSuccess?: () => void
}

export type UpdateOrderStatusResult = 'ok' | 'blocked' | 'error'

/**
 * Atualização de status com os mesmos fluxos de confirmação da lista/detalhe (saída / garantia).
 */
export function useOrderStatusUpdate () {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [blockerDialog, setBlockerDialog] = useState<OrderStatusBlockerDialogState | null>(null)

  const dismissBlockers = useCallback(() => {
    setBlockerDialog(null)
  }, [])

  const updateStatus = useCallback(
    async (
      orderId: string,
      newStatus: string,
      options?: UpdateOrderStatusExtraOptions,
    ): Promise<UpdateOrderStatusResult> => {
      const confirmIncompleteExit = options?.confirmIncompleteExit === true
      const confirmFinalizeWithoutWarranty =
        options?.confirmFinalizeWithoutWarranty === true

      setUpdating(true)
      try {
        const fd = new FormData()
        fd.set('orderId', orderId)
        fd.set('status', newStatus)
        if (confirmIncompleteExit) fd.set('confirmIncompleteExit', '1')
        if (confirmFinalizeWithoutWarranty) {
          fd.set('confirmFinalizeWithoutWarranty', '1')
        }

        const result = await updateOrderStatusAction(fd)
        if (result.ok === false) {
          if (result.error === 'finalize_blockers') {
            setBlockerDialog({
              orderId,
              status: newStatus,
              exit: result.exitIncomplete === true,
              warranty: result.warrantyMissing === true,
            })
            return 'blocked'
          }
          toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
          return 'error'
        }
        setBlockerDialog(null)
        toast({
          variant: 'success',
          title: 'Status atualizado',
          description: `${ORDER_STATUS_LABELS[newStatus] || newStatus}`,
        })
        router.refresh()
        options?.onAfterSuccess?.()
        return 'ok'
      } finally {
        setUpdating(false)
      }
    },
    [router],
  )

  return {
    updating,
    updateStatus,
    blockerDialog,
    dismissBlockers,
  }
}
