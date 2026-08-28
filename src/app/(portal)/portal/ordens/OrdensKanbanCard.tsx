'use client'

import { useDraggable } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'
import { type MouseEvent, memo, useCallback } from 'react'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'
import { cn } from '@/lib/utils'
import { useKanbanNavGuard } from './kanban-ghost-click-context'
import { OrdemCard } from './OrdemCard'
import { OrdensKanbanDropSkeleton } from './OrdensKanbanDropSkeleton'

const OrdemCardMemo = memo(OrdemCard)

type Props = {
  order: PortalOrdensListRow
  canDelete?: boolean
  columnDroppableId: string
  dragActiveId: string | null
  /** Só preenchido no card em arraste — reduz re-renders nos demais. */
  dragOverDroppableId: string | null
  /** Persistência do novo status após soltar no Kanban */
  isStatusSaving?: boolean
}

export const OrdensKanbanCard = memo(function OrdensKanbanCard ({
  order,
  canDelete,
  columnDroppableId,
  dragActiveId,
  dragOverDroppableId,
  isStatusSaving = false,
}: Props) {
  const { ghostOrderIdRef, suppressLinkUntilRef } = useKanbanNavGuard()

  const handleLinkClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (isStatusSaving || Date.now() < suppressLinkUntilRef.current) {
        e.preventDefault()
        return
      }
      if (ghostOrderIdRef.current === order.id) {
        e.preventDefault()
        ghostOrderIdRef.current = null
      }
    },
    [order.id, isStatusSaving, ghostOrderIdRef, suppressLinkUntilRef],
  )

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: order.id,
  })

  const isThisDragged = dragActiveId === order.id
  const pointerStillOverSourceColumn =
    isThisDragged && dragOverDroppableId === columnDroppableId
  const showSourceSlotSkeleton =
    isThisDragged && dragOverDroppableId !== columnDroppableId

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative rounded-md touch-pan-y',
        pointerStillOverSourceColumn && 'opacity-50 saturate-[0.72]',
        'cursor-grab active:cursor-grabbing',
      )}
      {...listeners}
      {...attributes}
    >
      {showSourceSlotSkeleton ? (
        <OrdensKanbanDropSkeleton className="border border-dashed border-muted-foreground/20 bg-muted/40" />
      ) : (
        <OrdemCardMemo
          order={order}
          canDelete={canDelete}
          layout="list"
          onLinkClick={handleLinkClick}
        />
      )}
      {isStatusSaving ? (
        <div
          className="absolute inset-0 z-30 flex cursor-wait items-center justify-center rounded-md bg-background/55 backdrop-blur-[1px]"
          aria-busy
          aria-live="polite"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Salvando status…</span>
        </div>
      ) : null}
    </div>
  )
})
