'use client'

import { memo, useCallback, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useKanbanGhostClickOrderIdRef } from './kanban-ghost-click-context'
import { OrdemCard } from './OrdemCard'
import { OrdensKanbanDropSkeleton } from './OrdensKanbanDropSkeleton'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

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
  const ghostClickOrderIdRef = useKanbanGhostClickOrderIdRef()

  const handleLinkClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (ghostClickOrderIdRef.current === order.id) {
        e.preventDefault()
        ghostClickOrderIdRef.current = null
      }
    },
    [order.id, ghostClickOrderIdRef],
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
        'relative rounded-md touch-none',
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
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/55 backdrop-blur-[1px]"
          aria-busy
          aria-live="polite"
        >
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Salvando status…</span>
        </div>
      ) : null}
    </div>
  )
})
