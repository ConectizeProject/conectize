'use client'

import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrdemCard } from './OrdemCard'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

const OrdemCardMemo = memo(OrdemCard)

type Props = {
  order: PortalOrdensListRow
  canDelete?: boolean
}

export function OrdensKanbanCard ({ order, canDelete }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex gap-1.5 items-start rounded-md',
        isDragging && 'opacity-0',
      )}
    >
      <button
        type="button"
        className={cn(
          'mt-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground',
          'touch-none cursor-grab active:cursor-grabbing',
        )}
        aria-label={`Arrastar ordem #${order.display_number ?? order.id}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <OrdemCardMemo order={order} canDelete={canDelete} layout="list" />
      </div>
    </div>
  )
}
