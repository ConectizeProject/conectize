'use client'

import { memo } from 'react'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
  order: PortalOrdensListRow
}

/**
 * Pré-visualização leve durante o arraste (evita montar OrdemCard + Radix em cada frame).
 */
function OrdensKanbanDragPreviewInner ({ order }: Props) {
  const num = order.display_number ?? order.id
  return (
    <div className="w-[min(100%,260px)] cursor-grabbing select-none rotate-[3deg] rounded-lg border bg-card px-3 py-2.5 shadow-2xl ring-1 ring-black/5">
      <p className="text-xs font-semibold tabular-nums text-muted-foreground">#{num}</p>
      <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug">{order.title}</p>
    </div>
  )
}

export const OrdensKanbanDragPreview = memo(OrdensKanbanDragPreviewInner)
