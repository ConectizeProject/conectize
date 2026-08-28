'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { ORDER_STATUS_LABELS } from '@/lib/orders/order-status'
import { updateOrderStatusAction } from './[numero]/order-detail-actions'
import { OrderWhatsappMessageDialog } from './OrderWhatsappMessageDialog'

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

export type UpdateOrderStatusResult = 'ok' | 'blocked' | 'error' | 'cancelled'

type ReadyPickupWhatsappState = {
  orderId: string
  message: string
}

type WhatsappPreviewResponse = {
  ok?: boolean
  message?: string
  auto_messages_enabled?: boolean
  evolution_available?: boolean
  has_phone?: boolean
  error?: string
}

/**
 * Atualização de status com os mesmos fluxos de confirmação da lista/detalhe (saída / garantia).
 * Em "Aguardando retirada", o status é aplicado na hora; o WhatsApp (Evolution) fica opcional
 * na modal (Não enviar / Enviar).
 */
export function useOrderStatusUpdate () {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [blockerDialog, setBlockerDialog] = useState<OrderStatusBlockerDialogState | null>(null)
  const [readyPickupWhatsapp, setReadyPickupWhatsapp] = useState<ReadyPickupWhatsappState | null>(null)
  const [readyPickupSending, setReadyPickupSending] = useState(false)

  const dismissBlockers = useCallback(() => {
    setBlockerDialog(null)
  }, [])

  const applyStatusChange = useCallback(async (
    orderId: string,
    newStatus: string,
    options?: UpdateOrderStatusExtraOptions,
  ): Promise<UpdateOrderStatusResult> => {
    const confirmIncompleteExit = options?.confirmIncompleteExit === true
    const confirmFinalizeWithoutWarranty = options?.confirmFinalizeWithoutWarranty === true

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
  }, [router])

  const maybeOfferReadyPickupWhatsapp = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(
        `/api/portal/ordens/${orderId}/whatsapp-message?mode=os_ready_for_pickup`,
      )
      const data = (await res.json().catch(() => null)) as WhatsappPreviewResponse | null
      if (
        res.ok &&
        data?.ok &&
        data.auto_messages_enabled === true &&
        data.evolution_available === true &&
        data.has_phone === true &&
        String(data.message || '').trim()
      ) {
        setReadyPickupWhatsapp({
          orderId,
          message: String(data.message),
        })
      }
    } catch {
      // status já foi aplicado; WhatsApp continua opcional
    }
  }, [])

  const updateStatus = useCallback(async (
    orderId: string,
    newStatus: string,
    options?: UpdateOrderStatusExtraOptions,
  ): Promise<UpdateOrderStatusResult> => {
    const statusResult = await applyStatusChange(orderId, newStatus, options)
    if (statusResult === 'ok' && newStatus === 'aguardando_retirada') {
      void maybeOfferReadyPickupWhatsapp(orderId)
    }
    return statusResult
  }, [applyStatusChange, maybeOfferReadyPickupWhatsapp])

  const dismissReadyPickupWhatsapp = useCallback(() => {
    if (readyPickupSending) return
    setReadyPickupWhatsapp(null)
  }, [readyPickupSending])

  const sendReadyPickupWhatsapp = useCallback(async () => {
    if (!readyPickupWhatsapp) return
    const pending = readyPickupWhatsapp
    setReadyPickupSending(true)
    try {
      const sendRes = await fetch(
        `/api/portal/ordens/${pending.orderId}/whatsapp-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'os_ready_for_pickup',
            text: pending.message,
          }),
        },
      )
      const sendData = await sendRes.json().catch(() => null)
      if (!sendRes.ok || !sendData?.ok) {
        toast({
          title: 'Não foi possível enviar o WhatsApp',
          description: String(
            sendData?.detail ||
              sendData?.error ||
              'Tente pelo menu Enviar WhatsApp.',
          ),
          variant: 'destructive',
        })
      } else {
        toast({
          variant: 'success',
          title: 'WhatsApp enviado',
          description: 'Mensagem de pronta para retirada enviada ao cliente.',
        })
      }
      setReadyPickupWhatsapp(null)
    } finally {
      setReadyPickupSending(false)
    }
  }, [readyPickupWhatsapp])

  const isDialogOpen = readyPickupWhatsapp != null
  const dialogMessage = readyPickupWhatsapp?.message || ''

  const ReadyPickupConfirmDialog = (
    <OrderWhatsappMessageDialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) dismissReadyPickupWhatsapp()
      }}
      title="Enviar WhatsApp?"
      description="O status já foi atualizado para Aguardando retirada. Deseja enviar esta mensagem pela Evolution?"
      message={dialogMessage}
      confirmLabel="Enviar"
      cancelLabel="Não enviar"
      sending={readyPickupSending}
      onConfirm={() => {
        void sendReadyPickupWhatsapp()
      }}
    />
  )

  return {
    updating: updating || readyPickupSending,
    updateStatus,
    blockerDialog,
    dismissBlockers,
    ReadyPickupConfirmDialog,
  }
}
