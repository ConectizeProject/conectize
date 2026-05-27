'use client'

import { Check, CheckCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaDeliveryStatus } from '@/lib/whatsapp/whatsapp-message-delivery-status'

type Props = {
  status: WaDeliveryStatus
}

const LABELS: Record<WaDeliveryStatus, string> = {
  sending: 'Enviando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  played: 'Reproduzida',
}

export function WhatsappMessageReceipt ({ status }: Props) {
  if (status === 'sending') {
    return (
      <Loader2
        className="h-[15px] w-[15px] shrink-0 animate-spin text-[#667781] dark:text-[#8696a0]"
        strokeWidth={2.25}
        aria-label={LABELS.sending}
        title={LABELS.sending}
      />
    )
  }

  const isRead = status === 'read' || status === 'played'
  const isDouble = status !== 'sent'
  const color = isRead
    ? 'text-[#53bdeb] dark:text-[#53bdeb]'
    : 'text-[#667781] dark:text-[#8696a0]'

  if (isDouble) {
    return (
      <CheckCheck
        className={cn('h-[15px] w-[15px] shrink-0', color)}
        strokeWidth={2.25}
        aria-label={LABELS[status]}
        title={LABELS[status]}
      />
    )
  }

  return (
    <Check
      className={cn('h-[15px] w-[15px] shrink-0', color)}
      strokeWidth={2.25}
      aria-label={LABELS[status]}
      title={LABELS[status]}
    />
  )
}
