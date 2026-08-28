'use client'

import { createContext, useContext } from 'react'
import type {
  UpdateOrderStatusExtraOptions,
  UpdateOrderStatusResult,
} from './use-order-status-update'

export type KanbanStatusChangeApi = {
  requestStatusChange: (
    orderId: string,
    nextStatus: string,
    options?: UpdateOrderStatusExtraOptions,
  ) => Promise<UpdateOrderStatusResult>
  isOrderSaving: (orderId: string) => boolean
}

export const KanbanStatusChangeContext =
  createContext<KanbanStatusChangeApi | null>(null)

export function useKanbanStatusChangeOptional (): KanbanStatusChangeApi | null {
  return useContext(KanbanStatusChangeContext)
}
