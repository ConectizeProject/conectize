'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringFrequency,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  FINALIZED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  FINALIZED_ORDER_STATUS_SET,
  isOpenOrderStatus,
} from '@/lib/orders/order-status'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { Button } from '@/components/ui/button'
import { OrderStatusBlockerAlertDialog } from './OrderStatusBlockerAlertDialog'
import { KanbanGhostClickOrderIdRefContext } from './kanban-ghost-click-context'
import {
  KANBAN_STATUS_ORDER,
  hasActiveKanbanFilters,
  kanbanColumnDroppableId,
  kanbanColumnsCollisionDetection,
  parseKanbanColumnStatus,
} from './ordens-kanban-columns'
import { OrdensKanbanColumn } from './OrdensKanbanColumn'
import { OrdensKanbanDragPreview } from './OrdensKanbanDragPreview'
import { useOrderStatusUpdate } from './use-order-status-update'
import type { UpdateOrderStatusResult } from './use-order-status-update'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

/** Colunas finais: primeira página e próximas requisições (scroll ou botão). */
const FINAL_INITIAL_PAGE_SIZE = 4
const FINAL_LOAD_MORE_PAGE_SIZE = 10

export type OrdensKanbanFilters = {
  q: string
  cpf: string
  osNumber: string
  status: string
  customerId: string
  customerName: string
  deviceModelId: string
  createdFrom: string
  createdTo: string
  readyFrom: string
  readyTo: string
}

type FinalColState = {
  items: PortalOrdensListRow[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  hasLoaded: boolean
}

/** Coluna final ainda não carregada (lazy até clique ou filtro ativo). */
function lazyFinalCol (): FinalColState {
  return {
    items: [],
    hasMore: false,
    loading: false,
    loadingMore: false,
    hasLoaded: false,
  }
}

function cloneOpenMap (
  src: Record<string, PortalOrdensListRow[]>,
): Record<string, PortalOrdensListRow[]> {
  const next: Record<string, PortalOrdensListRow[]> = {}
  for (const s of OPEN_ORDER_STATUSES) {
    next[s] = [...(src[s] ?? [])]
  }
  return next
}

function cloneFinalByStatus (
  src: Record<string, FinalColState>,
): Record<string, FinalColState> {
  const out: Record<string, FinalColState> = {}
  for (const s of FINALIZED_ORDER_STATUSES) {
    const c = src[s] ?? lazyFinalCol()
    out[s] = {
      ...c,
      items: [...c.items],
    }
  }
  return out
}

function removeOrderFromKanbanStatus (
  orderId: string,
  status: string,
  openCopy: Record<string, PortalOrdensListRow[]>,
  finalCopy: Record<string, FinalColState>,
) {
  if (isOpenOrderStatus(status)) {
    openCopy[status] = (openCopy[status] ?? []).filter((o) => o.id !== orderId)
  } else if (FINALIZED_ORDER_STATUS_SET.has(status)) {
    const col = finalCopy[status] ?? lazyFinalCol()
    finalCopy[status] = {
      ...col,
      items: col.items.filter((o) => o.id !== orderId),
    }
  }
}

function addOrderToKanbanStatus (
  order: PortalOrdensListRow,
  status: string,
  openCopy: Record<string, PortalOrdensListRow[]>,
  finalCopy: Record<string, FinalColState>,
) {
  if (isOpenOrderStatus(status)) {
    const list = openCopy[status] ?? []
    openCopy[status] = [order, ...list.filter((o) => o.id !== order.id)]
  } else if (FINALIZED_ORDER_STATUS_SET.has(status)) {
    const col = finalCopy[status] ?? lazyFinalCol()
    const items = [order, ...col.items.filter((o) => o.id !== order.id)]
    finalCopy[status] = {
      ...col,
      items,
      hasLoaded: true,
      loading: false,
      loadingMore: false,
    }
  }
}

function buildFinalOrdensParams (
  f: OrdensKanbanFilters,
  status: string,
  offset: number,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('statusGroup', 'final')
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  params.set('status', status)
  if (f.q) params.set('q', f.q)
  if (f.cpf) params.set('cpf', f.cpf)
  if (f.osNumber) params.set('osNumber', f.osNumber)
  if (f.customerId) params.set('customerId', f.customerId)
  if (f.customerName) params.set('customerName', f.customerName)
  if (f.deviceModelId) params.set('deviceModelId', f.deviceModelId)
  if (f.createdFrom) params.set('createdFrom', f.createdFrom)
  if (f.createdTo) params.set('createdTo', f.createdTo)
  if (f.readyFrom) params.set('readyFrom', f.readyFrom)
  if (f.readyTo) params.set('readyTo', f.readyTo)
  return params
}

type Props = {
  openOrdersByStatus: Record<string, PortalOrdensListRow[]>
  filters: OrdensKanbanFilters
  canDelete: boolean
}

export function OrdensKanbanBoard ({
  openOrdersByStatus,
  filters,
  canDelete,
}: Props) {
  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  const [finalByStatus, setFinalByStatus] = useState<
    Record<string, FinalColState>
  >(() => {
    const init: Record<string, FinalColState> = {}
    for (const s of FINALIZED_ORDER_STATUSES) {
      init[s] = lazyFinalCol()
    }
    return init
  })

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  /** Um ref global (clique fantasma após drag) — evita N× useDndMonitor nos cards. */
  const ghostClickOrderIdRef = useRef<string | null>(null)

  /** Sobrescreve listas “abertas” até o RSC refletir o novo status (evita o card voltar à coluna antiga). */
  const [openOverride, setOpenOverride] = useState<
    Record<string, PortalOrdensListRow[]> | null
  >(null)
  const [savingOrderIds, setSavingOrderIds] = useState(() => new Set<string>())

  const optimisticRevertRef = useRef<{
    openOverride: Record<string, PortalOrdensListRow[]> | null
    finalByStatus: Record<string, FinalColState>
  } | null>(null)

  const effectiveOpen = openOverride ?? openOrdersByStatus

  const openSnapshotKey = useMemo(
    () =>
      OPEN_ORDER_STATUSES.map((s) =>
        (openOrdersByStatus[s] ?? []).map((o) => `${o.id}:${o.status}`).join('|'),
      ).join('||'),
    [openOrdersByStatus],
  )

  useEffect(() => {
    setOpenOverride(null)
  }, [openSnapshotKey])

  const savingOrderIdsKey = useMemo(
    () => [...savingOrderIds].sort().join('|'),
    [savingOrderIds],
  )

  const savingByOrderId = useMemo(() => {
    const o: Record<string, true> = {}
    if (!savingOrderIdsKey) return o
    for (const id of savingOrderIdsKey.split('|')) {
      o[id] = true
    }
    return o
  }, [savingOrderIdsKey])

  const finalByStatusRef = useRef(finalByStatus)
  finalByStatusRef.current = finalByStatus

  const overRafRef = useRef<number | undefined>(undefined)
  const pendingOverIdRef = useRef<string | null>(null)

  const flushPendingOverId = useCallback(() => {
    overRafRef.current = undefined
    const next = pendingOverIdRef.current
    setOverId((prev) => (prev === next ? prev : next))
  }, [])

  const cancelOverRaf = useCallback(() => {
    if (overRafRef.current !== undefined) {
      cancelAnimationFrame(overRafRef.current)
      overRafRef.current = undefined
    }
  }, [])

  useEffect(() => {
    return () => {
      cancelOverRaf()
    }
  }, [cancelOverRaf])

  const { updating, updateStatus, blockerDialog, dismissBlockers } =
    useOrderStatusUpdate()

  const fetchFinalColumnPage = useCallback(
    async (status: string, offset: number, append: boolean) => {
      const pageLimit = append
        ? FINAL_LOAD_MORE_PAGE_SIZE
        : FINAL_INITIAL_PAGE_SIZE

      if (append) {
        setFinalByStatus((prev) => ({
          ...prev,
          [status]: { ...prev[status], loadingMore: true },
        }))
      } else if (offset === 0) {
        setFinalByStatus((prev) => ({
          ...prev,
          [status]: {
            ...prev[status],
            loading: true,
            loadingMore: false,
          },
        }))
      }

      try {
        const params = buildFinalOrdensParams(
          filtersRef.current,
          status,
          offset,
          pageLimit,
        )
        const res = await portalFetch(`/api/portal/ordens?${params.toString()}`)
        const data = await res?.json()
        const rows = data?.ok && Array.isArray(data.orders)
          ? (data.orders as PortalOrdensListRow[])
          : []
        const hasMore = data?.hasMore === true
        setFinalByStatus((prev) => {
          const cur = prev[status]
          const items = append ? [...cur.items, ...rows] : rows
          return {
            ...prev,
            [status]: {
              items,
              hasMore,
              loading: false,
              loadingMore: false,
              hasLoaded: true,
            },
          }
        })
      } catch {
        setFinalByStatus((prev) => ({
          ...prev,
          [status]: {
            ...prev[status],
            loading: false,
            loadingMore: false,
            hasLoaded: true,
          },
        }))
      }
    },
    [],
  )

  const requestLoadMore = useCallback((status: string) => {
    const col = finalByStatusRef.current[status]
    if (!col?.hasMore) return
    void fetchFinalColumnPage(status, col.items.length, true)
  }, [fetchFinalColumnPage])

  const reloadAllFinalColumns = useCallback(async () => {
    await Promise.all(
      FINALIZED_ORDER_STATUSES.map((s) => fetchFinalColumnPage(s, 0, false)),
    )
  }, [fetchFinalColumnPage])

  const filtersKey = useMemo(
    () =>
      [
        filters.q,
        filters.cpf,
        filters.osNumber,
        filters.status,
        filters.customerId,
        filters.customerName,
        filters.deviceModelId,
        filters.createdFrom,
        filters.createdTo,
        filters.readyFrom,
        filters.readyTo,
      ].join('\n'),
    [
      filters.q,
      filters.cpf,
      filters.osNumber,
      filters.status,
      filters.customerId,
      filters.customerName,
      filters.deviceModelId,
      filters.createdFrom,
      filters.createdTo,
      filters.readyFrom,
      filters.readyTo,
    ],
  )

  const filtersActive = useMemo(
    () => hasActiveKanbanFilters(filters),
    [filtersKey],
  )

  const [dismissedFilterExpand, setDismissedFilterExpand] = useState<
    Record<string, true>
  >({})

  useEffect(() => {
    if (!filtersActive) return
    let cancelled = false
    void (async () => {
      await Promise.all(
        FINALIZED_ORDER_STATUSES.map(async (s) => {
          if (cancelled) return
          await fetchFinalColumnPage(s, 0, false)
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [filtersActive, filtersKey, fetchFinalColumnPage])

  useEffect(() => {
    setDismissedFilterExpand({})
  }, [filtersKey])

  const reloadFinalColumnsAfterMutation = useCallback(async () => {
    if (hasActiveKanbanFilters(filtersRef.current)) {
      await reloadAllFinalColumns()
      return
    }
    const loaded = FINALIZED_ORDER_STATUSES.filter(
      (s) => finalByStatusRef.current[s]?.hasLoaded,
    )
    if (loaded.length === 0) return
    await Promise.all(loaded.map((s) => fetchFinalColumnPage(s, 0, false)))
  }, [reloadAllFinalColumns, fetchFinalColumnPage])

  const handleFinalStripActivate = useCallback(
    (status: string) => {
      void fetchFinalColumnPage(status, 0, false)
    },
    [fetchFinalColumnPage],
  )

  const handleDismissPinnedFilterExpand = useCallback((status: string) => {
    setDismissedFilterExpand((prev) => ({ ...prev, [status]: true }))
  }, [])

  const ordersById = useMemo(() => {
    const m = new Map<string, PortalOrdensListRow>()
    for (const status of OPEN_ORDER_STATUSES) {
      for (const o of effectiveOpen[status] ?? []) {
        m.set(o.id, o)
      }
    }
    for (const status of FINALIZED_ORDER_STATUSES) {
      for (const o of finalByStatus[status]?.items ?? []) {
        m.set(o.id, o)
      }
    }
    return m
  }, [effectiveOpen, finalByStatus])

  const totalOpen = useMemo(
    () =>
      OPEN_ORDER_STATUSES.reduce(
        (acc, s) => acc + (effectiveOpen[s]?.length ?? 0),
        0,
      ),
    [effectiveOpen],
  )

  const finalsLoadedForActiveFilter =
    filtersActive &&
    FINALIZED_ORDER_STATUSES.every((s) => finalByStatus[s]?.hasLoaded)
  const totalFinalItems = FINALIZED_ORDER_STATUSES.reduce(
    (acc, s) => acc + (finalByStatus[s]?.items?.length ?? 0),
    0,
  )
  const showEmptySplash =
    filtersActive &&
    totalOpen === 0 &&
    finalsLoadedForActiveFilter &&
    totalFinalItems === 0

  /** Mouse: arrastar após pequeno movimento. Touch: pressionar ~200ms evita roubar o scroll vertical. */
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  )

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      cancelOverRaf()
      const id = String(e.active.id)
      ghostClickOrderIdRef.current = id
      setActiveId(id)
      const order = ordersById.get(id)
      setOverId(
        order?.status != null ? kanbanColumnDroppableId(order.status) : null,
      )
    },
    [ordersById, cancelOverRaf],
  )

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const next = e.over?.id != null ? String(e.over.id) : null
      pendingOverIdRef.current = next
      if (overRafRef.current !== undefined) return
      overRafRef.current = requestAnimationFrame(flushPendingOverId)
    },
    [flushPendingOverId],
  )

  const handleDragCancel = useCallback(() => {
    cancelOverRaf()
    ghostClickOrderIdRef.current = null
    setActiveId(null)
    setOverId(null)
  }, [cancelOverRaf])

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const draggedId = String(e.active.id)
      cancelOverRaf()
      window.setTimeout(() => {
        if (ghostClickOrderIdRef.current === draggedId) {
          ghostClickOrderIdRef.current = null
        }
      }, 320)
      setActiveId(null)
      setOverId(null)
      if (updating) return
      const { active, over } = e
      if (!over) return
      const nextStatus = parseKanbanColumnStatus(String(over.id))
      if (!nextStatus) return
      const orderId = String(active.id)
      const order = ordersById.get(orderId)
      if (!order || order.status === nextStatus) return

      const fromStatus = order.status
      const nextOrder: PortalOrdensListRow = { ...order, status: nextStatus }

      optimisticRevertRef.current = {
        openOverride,
        finalByStatus: cloneFinalByStatus(finalByStatus),
      }

      const openCopy = cloneOpenMap(effectiveOpen)
      const finalCopy = cloneFinalByStatus(finalByStatus)
      removeOrderFromKanbanStatus(orderId, fromStatus, openCopy, finalCopy)
      addOrderToKanbanStatus(nextOrder, nextStatus, openCopy, finalCopy)

      const touchedOpen =
        isOpenOrderStatus(fromStatus) || isOpenOrderStatus(nextStatus)
      if (touchedOpen) {
        setOpenOverride(openCopy)
      }
      setFinalByStatus(finalCopy)

      setSavingOrderIds((prev) => new Set(prev).add(orderId))

      let result: UpdateOrderStatusResult = 'error'
      try {
        result = await updateStatus(orderId, nextStatus, {
          onAfterSuccess: () => {
            void reloadFinalColumnsAfterMutation()
          },
        })
      } finally {
        setSavingOrderIds((prev) => {
          const n = new Set(prev)
          n.delete(orderId)
          return n
        })
      }

      if (result === 'ok') {
        optimisticRevertRef.current = null
        return
      }

      const snap = optimisticRevertRef.current
      optimisticRevertRef.current = null
      if (snap) {
        setOpenOverride(snap.openOverride)
        setFinalByStatus(snap.finalByStatus)
      }
    },
    [
      ordersById,
      updateStatus,
      reloadFinalColumnsAfterMutation,
      updating,
      cancelOverRaf,
      openOverride,
      finalByStatus,
      effectiveOpen,
    ],
  )

  const activeOrder = activeId ? ordersById.get(activeId) ?? null : null
  const activeDragSourceStatus = activeOrder?.status ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {showEmptySplash ? (
        <div className="flex min-h-[min(40vh,320px)] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
          <img src="/empty-ordens.svg" alt="" className="mb-4 h-28 w-28 object-contain opacity-80" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nenhuma ordem encontrada com os filtros atuais.
          </p>
          <Button asChild className="mt-4" variant="secondary" size="sm">
            <Link href="/portal/ordens/nova" transitionTypes={['nav-forward']}>Nova ordem</Link>
          </Button>
        </div>
      ) : null}

      {showEmptySplash ? null : (
        <div className="flex min-h-0 flex-1 flex-col">
        <DndContext
          sensors={sensors}
          autoScroll={{ layoutShiftCompensation: false }}
          collisionDetection={kanbanColumnsCollisionDetection}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.WhileDragging,
              frequency: MeasuringFrequency.Optimized,
            },
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <KanbanGhostClickOrderIdRefContext.Provider value={ghostClickOrderIdRef}>
          <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {KANBAN_STATUS_ORDER.map((status) => {
              const isOpen = isOpenOrderStatus(status)
              const list = isOpen
                ? (effectiveOpen[status] ?? [])
                : (finalByStatus[status]?.items ?? [])
              const col = finalByStatus[status]
              const expandPinnedFromFilter =
                !isOpen &&
                filtersActive &&
                !dismissedFilterExpand[status] &&
                (col?.hasLoaded ?? false) &&
                (col?.items?.length ?? 0) > 0
              return (
                <OrdensKanbanColumn
                  key={status}
                  status={status}
                  orders={list}
                  canDelete={canDelete}
                  isFinalColumn={!isOpen}
                  hasMore={!isOpen ? col?.hasMore : false}
                  loadingMore={!isOpen ? col?.loadingMore : false}
                  columnLoading={!isOpen ? !!col?.loading : false}
                  onRequestLoadMore={!isOpen ? requestLoadMore : undefined}
                  dragActiveId={activeId}
                  dragOverId={overId}
                  activeDragSourceStatus={activeDragSourceStatus}
                  savingByOrderId={savingByOrderId}
                  expandPinnedFromFilter={expandPinnedFromFilter}
                  finalColumnHasLoaded={!isOpen ? (col?.hasLoaded ?? false) : true}
                  onFinalStripActivate={!isOpen ? handleFinalStripActivate : undefined}
                  onDismissPinnedFilterExpand={
                    !isOpen ? handleDismissPinnedFilterExpand : undefined
                  }
                />
              )
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOrder ? <OrdensKanbanDragPreview order={activeOrder} /> : null}
          </DragOverlay>
          </KanbanGhostClickOrderIdRefContext.Provider>
        </DndContext>
        </div>
      )}

      <div className="shrink-0">
        <OrderStatusBlockerAlertDialog
          open={!!blockerDialog}
          blocker={blockerDialog}
          updating={updating}
          onOpenChange={(open) => {
            if (!open) dismissBlockers()
          }}
          onConfirm={() => {
            if (!blockerDialog) return
            void updateStatus(blockerDialog.orderId, blockerDialog.status, {
              confirmIncompleteExit: blockerDialog.exit,
              confirmFinalizeWithoutWarranty: blockerDialog.warranty,
              onAfterSuccess: () => {
                void reloadFinalColumnsAfterMutation()
              },
            })
          }}
        />
      </div>
    </div>
  )
}
