'use client'

import { OrdensKanbanBoard } from './OrdensKanbanBoard'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <OrdensKanbanBoard
      key={`kanban-${filterQ}-${filterCpf}-${filterOsNumber}-${filterStatus}-${filterCustomerId}-${filterCustomerName}-${filterDeviceModelId}-${filterCreatedFrom}-${filterCreatedTo}-${filterReadyFrom}-${filterReadyTo}`}
      openOrdersByStatus={openOrdersByStatus}
      filters={filters}
      canDelete={canDelete}
    />
    </div>
  )
}
