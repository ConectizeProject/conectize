'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'
import { OrderWhatsappMessageDialog } from '../OrderWhatsappMessageDialog'
import { OrdemAfterCreateCupomDialog } from './OrdemAfterCreateCupomDialog'

type Props = {
  orderId: string
  displayNumber: string | number | null
}

type WhatsappPreviewResponse = {
  ok?: boolean
  message?: string
  auto_messages_enabled?: boolean
  evolution_available?: boolean
  has_phone?: boolean
}

export function OrdemDetalheToastClient ({ orderId, displayNumber }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cupomDialogOpen, setCupomDialogOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [whatsappSending, setWhatsappSending] = useState(false)
  const openCupomAfterWhatsappRef = useRef(false)
  const handledOrderCreatedRef = useRef(false)

  const openCupomDialog = useCallback(() => {
    setCupomDialogOpen(true)
  }, [])

  const maybeOpenWhatsappThenCupom = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/portal/ordens/${encodeURIComponent(orderId)}/whatsapp-message?mode=os_opened`,
      )
      const data = (await res.json().catch(() => null)) as WhatsappPreviewResponse | null
      const message = String(data?.message || '').trim()
      if (
        res.ok &&
        data?.ok &&
        data.auto_messages_enabled === true &&
        data.evolution_available === true &&
        data.has_phone === true &&
        message
      ) {
        openCupomAfterWhatsappRef.current = true
        setWhatsappMessage(message)
        setWhatsappOpen(true)
        return
      }
    } catch {
      // segue só com o cupom
    }
    openCupomDialog()
  }, [orderId, openCupomDialog])

  useEffect(() => {
    const errorCode = searchParams.get('error')
    const ok = searchParams.get('ok')
    const toastType = searchParams.get('toast')

    const params = new URLSearchParams(searchParams.toString())
    let shouldReplace = false

    if (errorCode) {
      const saveEc = searchParams.get('ec')
      const saveEm = searchParams.get('em')
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir',
        description: getOrdemErrorMessage(errorCode, undefined, {
          saveDbCode: saveEc,
          saveDbMessage: saveEm,
        }),
      })
      params.delete('error')
      params.delete('ec')
      params.delete('em')
      shouldReplace = true
    } else if (ok === '1') {
      toast({
        variant: 'success',
        title: 'Dados salvos',
        description: 'As alterações da ordem de serviço foram salvas com sucesso.',
      })
      params.delete('ok')
      shouldReplace = true
    } else if (toastType === 'order_created') {
      toast({
        variant: 'success',
        title: 'Ordem criada',
        description: 'Ordem de serviço criada com sucesso.',
      })
      if (!handledOrderCreatedRef.current) {
        handledOrderCreatedRef.current = true
        void maybeOpenWhatsappThenCupom()
      }
      params.delete('toast')
      shouldReplace = true
    }

    if (!shouldReplace) return

    const qs = params.toString()
    const pathname = window.location.pathname
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams, maybeOpenWhatsappThenCupom])

  function finishWhatsappFlow () {
    setWhatsappOpen(false)
    if (openCupomAfterWhatsappRef.current) {
      openCupomAfterWhatsappRef.current = false
      openCupomDialog()
    }
  }

  async function confirmWhatsappSend () {
    if (!whatsappMessage.trim()) return
    setWhatsappSending(true)
    try {
      const res = await fetch(
        `/api/portal/ordens/${encodeURIComponent(orderId)}/whatsapp-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'os_opened',
            text: whatsappMessage,
          }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao enviar WhatsApp',
          description: String(data?.detail || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      toast({
        variant: 'success',
        title: 'WhatsApp enviado',
        description: 'Mensagem de abertura da OS enviada ao cliente.',
      })
      finishWhatsappFlow()
    } finally {
      setWhatsappSending(false)
    }
  }

  return (
    <>
      <OrderWhatsappMessageDialog
        open={whatsappOpen}
        onOpenChange={(open) => {
          if (whatsappSending) return
          if (!open) finishWhatsappFlow()
          else setWhatsappOpen(true)
        }}
        title="Enviar WhatsApp automático?"
        description="A ordem foi criada. Deseja enviar esta mensagem ao cliente pela Evolution?"
        message={whatsappMessage}
        confirmLabel="Enviar"
        cancelLabel="Não enviar"
        sending={whatsappSending}
        onConfirm={() => {
          void confirmWhatsappSend()
        }}
      />
      <OrdemAfterCreateCupomDialog
        open={cupomDialogOpen}
        onOpenChange={setCupomDialogOpen}
        orderId={orderId}
        displayNumber={displayNumber}
      />
    </>
  )
}
