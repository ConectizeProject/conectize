'use client'

import { Bot, Loader2, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { WhatsappMessageMedia } from './WhatsappMessageMedia'
import { resolveOutboundDeliveryStatus } from '@/lib/whatsapp/whatsapp-message-delivery-status'
import { WhatsappMessageReceipt } from './WhatsappMessageReceipt'
import { formatWaMessageTime } from './whatsapp-inbox-utils'

type Props = {
  direction: string
  body: string | null
  payload?: Record<string, unknown>
  mediaUrl: string | null
  mediaExpired: boolean
  createdAt: string
  isDeleted: boolean
  fromAi: boolean
  fromPhone: boolean
  needsReview: boolean
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onDelete?: () => void
  deleting?: boolean
}

export function WhatsappMessageBubble ({
  direction,
  body,
  payload,
  mediaUrl,
  mediaExpired,
  createdAt,
  isDeleted,
  fromAi,
  fromPhone,
  needsReview,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onDelete,
  deleting = false,
}: Props) {
  const isOut = direction === 'out'
  const time = formatWaMessageTime(createdAt)
  const deliveryStatus = isOut && !isDeleted
    ? resolveOutboundDeliveryStatus(payload)
    : null

  return (
    <div
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={selectionMode ? onToggleSelect : undefined}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleSelect?.()
              }
            }
          : undefined
      }
      className={cn(
        'group/msg flex w-full items-start gap-1',
        isOut ? 'flex-row-reverse justify-start' : 'justify-start',
        selectionMode && 'cursor-pointer rounded-md py-0.5',
        selectionMode && selected && 'bg-[#111b21]/5 dark:bg-white/5',
      )}
    >
      {selectionMode ? (
        <span
          className={cn('mt-2 flex shrink-0 items-center', isOut ? 'order-last' : '')}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.()}
            aria-label={selected ? 'Desmarcar mensagem' : 'Selecionar mensagem'}
          />
        </span>
      ) : onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className={cn(
            'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#54656f]',
            'opacity-0 transition-opacity hover:bg-black/10 group-hover/msg:opacity-100',
            'focus:opacity-100 dark:text-[#8696a0] dark:hover:bg-white/10',
            deleting && 'opacity-100',
          )}
          aria-label="Excluir mensagem do portal"
          title="Excluir do portal (não apaga no WhatsApp)"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      ) : null}
      <div
        className={cn(
          'relative min-w-0 max-w-[min(85%,420px)] overflow-hidden rounded-lg px-2 pb-1 pt-1.5 text-[14.2px] leading-[19px] shadow-sm',
          selectionMode && selected && 'ring-2 ring-primary/40',
          isDeleted
            ? 'border border-destructive/40 bg-destructive/10 text-destructive'
            : isOut
              ? 'rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
              : 'rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]',
        )}
      >
        {(fromAi || fromPhone || needsReview || isDeleted) ? (
          <div className="mb-0.5 flex flex-wrap gap-1 px-1">
            {isDeleted ? (
              <span className="rounded bg-destructive/15 px-1 py-0 text-[10px] font-medium text-destructive">
                excluída no WhatsApp
              </span>
            ) : null}
            {fromAi ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-[#111b21]/10 px-1 py-0 text-[10px] dark:bg-white/10">
                <Bot className="h-3 w-3" /> IA
              </span>
            ) : null}
            {fromPhone ? (
              <span className="rounded bg-[#111b21]/10 px-1 py-0 text-[10px] dark:bg-white/10">
                Celular
              </span>
            ) : null}
            {needsReview ? (
              <span className="rounded bg-amber-500/25 px-1 py-0 text-[10px] text-amber-900 dark:text-amber-100">
                aguardando revisão
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 max-w-full px-2 pb-0.5">
          <WhatsappMessageMedia
            body={body}
            payload={payload}
            mediaUrl={mediaUrl}
            mediaExpired={mediaExpired}
            isDeleted={isDeleted}
          />
        </div>
        <div
          className={cn(
            'flex items-center justify-end gap-1 px-2 pb-1 text-[11px] tabular-nums',
            isOut ? 'text-[#667781] dark:text-[#8696a0]' : 'text-[#667781] dark:text-[#8696a0]',
          )}
        >
          <span>{time}</span>
          {deliveryStatus ? <WhatsappMessageReceipt status={deliveryStatus} /> : null}
        </div>
      </div>
    </div>
  )
}
