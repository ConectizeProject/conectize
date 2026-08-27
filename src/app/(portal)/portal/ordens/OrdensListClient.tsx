'use client'

import { useEffect, useState } from 'react'
import { OrdensKanbanBoard } from './OrdensKanbanBoard'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

/**
 * @dnd-kit gera `aria-describedby` instável entre SSR e cliente — o quadro só
 * monta após `useEffect` (servidor e 1º paint no cliente mostram o mesmo placeholder).
 */
function KanbanLoadingPlaceholder () {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground"
      aria-busy
      aria-live="polite"
    >
      Carregando quadro de ordens…
    </div>
  )
}

type KanbanProps = {
  openOrdersByStatus: Record<string, PortalOrdensListRow[]>
  filters: {
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
  canDelete: boolean
  mountKey: string
}

function OrdensKanbanBoardMountGate ({
  openOrdersByStatus,
  filters,
  canDelete,
  mountKey,
}: KanbanProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  if (!ready) {
    return <KanbanLoadingPlaceholder />
  }

  return (
    <OrdensKanbanBoard
      key={mountKey}
      openOrdersByStatus={openOrdersByStatus}
      filters={filters}
      canDelete={canDelete}
    />
  )
}

type Props = {
  openOrdersByStatus: Record<string, PortalOrdensListRow[]>
  filterQ: string
  filterCpf: string
  filterOsNumber: string
  filterStatus: string
  filterCustomerId?: string
  filterCustomerName?: string
  filterDeviceModelId?: string
  filterCreatedFrom?: string
  filterCreatedTo?: string
  filterReadyFrom?: string
  filterReadyTo?: string
  canDelete: boolean
}

export function OrdensListClient ({
  openOrdersByStatus,
  filterQ,
  filterCpf,
  filterOsNumber,
  filterStatus,
  filterCustomerId = '',
  filterCustomerName = '',
  filterDeviceModelId = '',
  filterCreatedFrom = '',
  filterCreatedTo = '',
  filterReadyFrom = '',
  filterReadyTo = '',
  canDelete,
}: Props) {
  const filters = {
    q: filterQ,
    cpf: filterCpf,
    osNumber: filterOsNumber,
    status: filterStatus,
    customerId: filterCustomerId,
    customerName: filterCustomerName,
    deviceModelId: filterDeviceModelId,
    createdFrom: filterCreatedFrom,
    createdTo: filterCreatedTo,
    readyFrom: filterReadyFrom,
    readyTo: filterReadyTo,
  }

  const mountKey = `kanban-${filterQ}-${filterCpf}-${filterOsNumber}-${filterStatus}-${filterCustomerId}-${filterCustomerName}-${filterDeviceModelId}-${filterCreatedFrom}-${filterCreatedTo}-${filterReadyFrom}-${filterReadyTo}`

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <OrdensKanbanBoardMountGate
        mountKey={mountKey}
        openOrdersByStatus={openOrdersByStatus}
        filters={filters}
        canDelete={canDelete}
      />
    </div>
  )
}
