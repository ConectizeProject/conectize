'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UIEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getOrderStatusLabel } from '@/lib/orders/order-status'
import {
  KANBAN_STATUS_DOT_CLASSES,
  kanbanColumnDragUiKey,
  kanbanColumnDroppableId,
} from './ordens-kanban-columns'
import { OrdensKanbanCard } from './OrdensKanbanCard'
import { OrdensKanbanDropSkeleton } from './OrdensKanbanDropSkeleton'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
  status: string
  orders: PortalOrdensListRow[]
  canDelete: boolean
  isFinalColumn: boolean
  hasMore?: boolean
  loadingMore?: boolean
  columnLoading?: boolean
  /** Referência estável no board: `requestLoadMore(status)` */
  onRequestLoadMore?: (status: string) => void
  dragActiveId: string | null
  dragOverId: string | null
  activeDragSourceStatus: string | null
  /** Chave estável (`id|id`) para memo — OS com salvamento de status em andamento */
  savingByOrderId: Record<string, true>
  /** Com filtro ativo: mantém a coluna final aberta quando há OS na coluna. */
  expandPinnedFromFilter?: boolean
  /** Coluna final já buscou dados na API (false = lazy até clique). */
  finalColumnHasLoaded?: boolean
  /** Coluna final recolhida: primeira abertura dispara fetch no board. */
  onFinalStripActivate?: (status: string) => void
  /** Recolher coluna expandida por filtro (volta à faixa estreita). */
  onDismissPinnedFilterExpand?: (status: string) => void
}

function areOrdensKanbanColumnPropsEqual (prev: Props, next: Props): boolean {
  if (prev.status !== next.status) return false
  if (prev.orders !== next.orders) return false
  if (prev.canDelete !== next.canDelete) return false
  if (prev.isFinalColumn !== next.isFinalColumn) return false
  if (prev.hasMore !== next.hasMore) return false
  if (prev.loadingMore !== next.loadingMore) return false
  if (prev.columnLoading !== next.columnLoading) return false
  if (prev.onRequestLoadMore !== next.onRequestLoadMore) return false
  if (prev.savingByOrderId !== next.savingByOrderId) return false
  if (prev.expandPinnedFromFilter !== next.expandPinnedFromFilter) return false
  if (prev.finalColumnHasLoaded !== next.finalColumnHasLoaded) return false
  if (prev.onFinalStripActivate !== next.onFinalStripActivate) return false
  if (prev.onDismissPinnedFilterExpand !== next.onDismissPinnedFilterExpand) {
    return false
  }
  if (
    kanbanColumnDragUiKey(
      prev.status,
      prev.orders,
      prev.dragActiveId,
      prev.dragOverId,
      prev.activeDragSourceStatus,
    )
    !== kanbanColumnDragUiKey(
      next.status,
      next.orders,
      next.dragActiveId,
      next.dragOverId,
      next.activeDragSourceStatus,
    )
  ) {
    return false
  }
  return true
}

export const OrdensKanbanColumn = memo(function OrdensKanbanColumn ({
  status,
  orders,
  canDelete,
  isFinalColumn,
  hasMore = false,
  loadingMore = false,
  columnLoading = false,
  onRequestLoadMore,
  dragActiveId,
  dragOverId,
  activeDragSourceStatus,
  savingByOrderId,
  expandPinnedFromFilter = false,
  finalColumnHasLoaded = true,
  onFinalStripActivate,
  onDismissPinnedFilterExpand,
}: Props) {
  const droppableId = kanbanColumnDroppableId(status)
  const { setNodeRef } = useDroppable({ id: droppableId })
  const label = getOrderStatusLabel(status)
  const dotClass =
    KANBAN_STATUS_DOT_CLASSES[status] ??
    'bg-muted shadow-[0_0_0.6rem_rgba(148,163,184,0.7)]'

  const showTargetDropSkeleton =
    !!dragActiveId &&
    !!dragOverId &&
    dragOverId === droppableId &&
    activeDragSourceStatus != null &&
    activeDragSourceStatus !== status

  const scrollRootRef = useRef<HTMLDivElement>(null)
  const [listOverflows, setListOverflows] = useState(false)
  const lastScrollLoadAtRef = useRef(0)
  const prevOrderCountRef = useRef<number | null>(null)

  const isEmptyContent = orders.length === 0 && !columnLoading
  const [manuallyExpanded, setManuallyExpanded] = useState(false)

  useEffect(() => {
    const prev = prevOrderCountRef.current
    prevOrderCountRef.current = orders.length
    if (isFinalColumn) {
      if (prev != null && prev > 0 && orders.length === 0) {
        setManuallyExpanded(false)
      }
      return
    }
    if (orders.length > 0) {
      setManuallyExpanded(false)
      return
    }
    if (prev != null && prev > 0 && orders.length === 0) {
      setManuallyExpanded(false)
    }
  }, [orders.length, isFinalColumn])

  /**
   * Faixa estreita: colunas de pipeline vazias, ou colunas finais (lazy até clique / filtro).
   * `expandPinnedFromFilter` mantém abertas as finais com resultado quando há filtro ativo.
   */
  const showCollapsedStrip =
    !manuallyExpanded &&
    !expandPinnedFromFilter &&
    !columnLoading &&
    (isFinalColumn || isEmptyContent)

  useLayoutEffect(() => {
    const el = scrollRootRef.current
    if (!el) return
    const measure = () => {
      setListOverflows(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [orders.length, columnLoading, loadingMore])

  const handleListScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      if (!isFinalColumn || !onRequestLoadMore || !hasMore) return
      if (loadingMore || columnLoading) return
      const el = e.currentTarget
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      if (gap > 100) return
      const now = Date.now()
      if (now - lastScrollLoadAtRef.current < 450) return
      lastScrollLoadAtRef.current = now
      onRequestLoadMore(status)
    },
    [
      isFinalColumn,
      onRequestLoadMore,
      hasMore,
      loadingMore,
      columnLoading,
      status,
    ],
  )

  const showManualLoadMore =
    isFinalColumn && hasMore && onRequestLoadMore && !listOverflows

  if (showCollapsedStrip) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex h-full min-h-0 w-12 shrink-0 flex-col rounded-xl border bg-muted/40 transition-[box-shadow,border-color]',
          showTargetDropSkeleton &&
            'border-primary shadow-[0_0_0_2px_hsl(var(--primary)_/_0.35)]',
        )}
        role="region"
        aria-label={`Coluna ${label} (recolhida)`}
      >
        <button
          type="button"
          className="flex min-h-[120px] flex-1 flex-col items-center justify-start gap-0 pt-3 pb-4 hover:bg-muted/50"
          onClick={() => {
            if (isFinalColumn && !finalColumnHasLoaded) {
              onFinalStripActivate?.(status)
            }
            setManuallyExpanded(true)
          }}
          aria-expanded={false}
          aria-label={
            isFinalColumn && !finalColumnHasLoaded
              ? `Carregar e abrir coluna ${label}`
              : `Abrir coluna ${label}`
          }
          title={
            isFinalColumn && !finalColumnHasLoaded
              ? 'Clique para carregar as ordens desta coluna'
              : undefined
          }
        >
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} aria-hidden />
          <span
            className="mt-2 max-h-[min(42vh,14rem)] min-h-0 shrink overflow-hidden text-center text-[10px] font-medium leading-tight text-muted-foreground [text-orientation:mixed] [writing-mode:vertical-rl]"
            title={label}
          >
            {label}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className="flex h-full min-h-0 w-[min(100%,280px)] shrink-0 flex-col rounded-xl border bg-muted/40"
      role="region"
      aria-label={`Coluna ${label}`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/60 px-3 py-2.5">
        {isFinalColumn || isEmptyContent ? (
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={() => {
              if (expandPinnedFromFilter && onDismissPinnedFilterExpand) {
                onDismissPinnedFilterExpand(status)
                return
              }
              setManuallyExpanded(false)
            }}
            aria-label={`Recolher coluna ${label}`}
            title="Recolher coluna"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} aria-hidden />
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        {!isFinalColumn ? (
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {orders.length}
          </span>
        ) : null}
      </div>
      <div
        ref={scrollRootRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2"
        onScroll={isFinalColumn ? handleListScroll : undefined}
      >
        {columnLoading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : orders.length === 0 ? (
          <>
            {showTargetDropSkeleton ? <OrdensKanbanDropSkeleton /> : null}
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma OS</p>
          </>
        ) : (
          <>
            {showTargetDropSkeleton ? <OrdensKanbanDropSkeleton /> : null}
            {orders.map((order) => (
              <OrdensKanbanCard
                key={order.id}
                order={order}
                canDelete={canDelete}
                columnDroppableId={droppableId}
                dragActiveId={dragActiveId}
                dragOverDroppableId={dragActiveId === order.id ? dragOverId : null}
                isStatusSaving={savingByOrderId[order.id] === true}
              />
            ))}
            {isFinalColumn && loadingMore ? (
              <div
                className="flex min-h-[120px] shrink-0 flex-col items-center justify-center gap-3 rounded-lg border bg-card px-4 py-6 text-center text-card-foreground shadow-sm"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-7 w-7 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground">Carregando mais ordens…</span>
              </div>
            ) : null}
            {showManualLoadMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 shrink-0"
                onClick={() => {
                  onRequestLoadMore(status)
                }}
                disabled={loadingMore || columnLoading}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}, areOrdensKanbanColumnPropsEqual)
