'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  FINALIZED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  isOpenOrderStatus,
} from '@/lib/orders/order-status'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { Button } from '@/components/ui/button'
import { OrderStatusBlockerAlertDialog } from './OrderStatusBlockerAlertDialog'
import {
  KANBAN_STATUS_ORDER,
  parseKanbanColumnStatus,
} from './ordens-kanban-columns'
import { OrdensKanbanColumn } from './OrdensKanbanColumn'
import { OrdensKanbanDragPreview } from './OrdensKanbanDragPreview'
import { useOrderStatusUpdate } from './use-order-status-update'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

const FINAL_PAGE_SIZE = 50

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

function emptyFinalCol (): FinalColState {
  return {
    items: [],
    hasMore: false,
    loading: true,
    loadingMore: false,
    hasLoaded: false,
  }
}

function buildFinalOrdensParams (
  f: OrdensKanbanFilters,
  status: string,
  offset: number,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('statusGroup', 'final')
  params.set('limit', String(FINAL_PAGE_SIZE))
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
      init[s] = emptyFinalCol()
    }
    return init
  })

  const [activeId, setActiveId] = useState<string | null>(null)

  const { updating, updateStatus, blockerDialog, dismissBlockers } =
    useOrderStatusUpdate()

  const fetchFinalColumnPage = useCallback(
    async (status: string, offset: number, append: boolean) => {
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
        const params = buildFinalOrdensParams(filtersRef.current, status, offset)
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

  const reloadAllFinalColumns = useCallback(async () => {
    await Promise.all(
      FINALIZED_ORDER_STATUSES.map((s) => fetchFinalColumnPage(s, 0, false)),
    )
  }, [fetchFinalColumnPage])

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      FINALIZED_ORDER_STATUSES.map(async (s) => {
        if (cancelled) return
        await fetchFinalColumnPage(s, 0, false)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [fetchFinalColumnPage])

  const ordersById = useMemo(() => {
    const m = new Map<string, PortalOrdensListRow>()
    for (const status of OPEN_ORDER_STATUSES) {
      for (const o of openOrdersByStatus[status] ?? []) {
        m.set(o.id, o)
      }
    }
    for (const status of FINALIZED_ORDER_STATUSES) {
      for (const o of finalByStatus[status]?.items ?? []) {
        m.set(o.id, o)
      }
    }
    return m
  }, [openOrdersByStatus, finalByStatus])

  const totalOpen = useMemo(
    () =>
      OPEN_ORDER_STATUSES.reduce(
        (acc, s) => acc + (openOrdersByStatus[s]?.length ?? 0),
        0,
      ),
    [openOrdersByStatus],
  )

  const finalsLoaded = FINALIZED_ORDER_STATUSES.every(
    (s) => finalByStatus[s]?.hasLoaded,
  )
  const totalFinalItems = FINALIZED_ORDER_STATUSES.reduce(
    (acc, s) => acc + (finalByStatus[s]?.items?.length ?? 0),
    0,
  )
  const showEmptySplash =
    totalOpen === 0 && finalsLoaded && totalFinalItems === 0

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }, [])

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveId(null)
      if (updating) return
      const { active, over } = e
      if (!over) return
      const nextStatus = parseKanbanColumnStatus(String(over.id))
      if (!nextStatus) return
      const orderId = String(active.id)
      const order = ordersById.get(orderId)
      if (!order || order.status === nextStatus) return

      await updateStatus(orderId, nextStatus, {
        onAfterSuccess: () => {
          void reloadAllFinalColumns()
        },
      })
    },
    [ordersById, updateStatus, reloadAllFinalColumns, updating],
  )

  const activeOrder = activeId ? ordersById.get(activeId) ?? null : null

  return (
    <div className="space-y-4">
      {showEmptySplash ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
          <img src="/empty-ordens.svg" alt="" className="mb-4 h-28 w-28 object-contain opacity-80" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Nenhuma ordem encontrada com os filtros atuais.
          </p>
          <Button asChild className="mt-4" variant="secondary" size="sm">
            <Link href="/portal/ordens/nova">Nova ordem</Link>
          </Button>
        </div>
      ) : null}

      {showEmptySplash ? null : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
            {KANBAN_STATUS_ORDER.map((status) => {
              const isOpen = isOpenOrderStatus(status)
              const list = isOpen
                ? (openOrdersByStatus[status] ?? [])
                : (finalByStatus[status]?.items ?? [])
              const col = finalByStatus[status]
              return (
                <OrdensKanbanColumn
                  key={status}
                  status={status}
                  orders={list}
                  canDelete={canDelete}
                  isFinalColumn={!isOpen}
                  hasMore={!isOpen ? col?.hasMore : false}
                  loadingMore={!isOpen ? col?.loadingMore : false}
                  columnLoading={
                    !isOpen ? col?.loading === true && !col?.hasLoaded : false
                  }
                  onLoadMore={
                    !isOpen && col?.hasMore
                      ? () => {
                          void fetchFinalColumnPage(status, col.items.length, true)
                        }
                      : undefined
                  }
                />
              )
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOrder ? <OrdensKanbanDragPreview order={activeOrder} /> : null}
          </DragOverlay>
        </DndContext>
      )}

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
              void reloadAllFinalColumns()
            },
          })
        }}
      />
    </div>
  )
}
