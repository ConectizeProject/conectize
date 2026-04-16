'use client'

import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import {
  KANBAN_STATUS_DOT_CLASSES,
  kanbanColumnDroppableId,
} from './ordens-kanban-columns'
import { OrdensKanbanCard } from './OrdensKanbanCard'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type BodyProps = {
  orders: PortalOrdensListRow[]
  canDelete: boolean
  isFinalColumn: boolean
  hasMore: boolean
  loadingMore: boolean
  columnLoading: boolean
  onLoadMore?: () => void
}

/** Corpo da coluna isolado: mudanças só em `isOver` no pai não re-renderizam os cartões. */
const OrdensKanbanColumnBody = memo(function OrdensKanbanColumnBody ({
  orders,
  canDelete,
  isFinalColumn,
  hasMore,
  loadingMore,
  columnLoading,
  onLoadMore,
}: BodyProps) {
  return (
    <div className="flex max-h-[min(70vh,520px)] min-h-[120px] flex-col gap-2 overflow-y-auto overflow-x-hidden p-2">
      {columnLoading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma OS</p>
      ) : (
        orders.map((order) => (
          <OrdensKanbanCard key={order.id} order={order} canDelete={canDelete} />
        ))
      )}
      {isFinalColumn && hasMore && onLoadMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 shrink-0"
          onClick={onLoadMore}
          disabled={loadingMore || columnLoading}
        >
          {loadingMore ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              Carregando…
            </>
          ) : (
            'Carregar mais'
          )}
        </Button>
      ) : null}
    </div>
  )
})

type Props = {
  status: string
  orders: PortalOrdensListRow[]
  canDelete: boolean
  isFinalColumn: boolean
  hasMore?: boolean
  loadingMore?: boolean
  columnLoading?: boolean
  onLoadMore?: () => void
}

export function OrdensKanbanColumn ({
  status,
  orders,
  canDelete,
  isFinalColumn,
  hasMore = false,
  loadingMore = false,
  columnLoading = false,
  onLoadMore,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: kanbanColumnDroppableId(status) })
  const label = getOrderStatusLabel(status)
  const dotClass =
    KANBAN_STATUS_DOT_CLASSES[status] ??
    'bg-muted shadow-[0_0_0.6rem_rgba(148,163,184,0.7)]'

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border bg-muted/40',
        isOver && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background',
      )}
      role="region"
      aria-label={`Coluna ${label}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/60 px-3 py-2.5">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} aria-hidden />
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {orders.length}
        </span>
      </div>
      <OrdensKanbanColumnBody
        orders={orders}
        canDelete={canDelete}
        isFinalColumn={isFinalColumn}
        hasMore={hasMore}
        loadingMore={loadingMore}
        columnLoading={columnLoading}
        onLoadMore={onLoadMore}
      />
    </div>
  )
}
