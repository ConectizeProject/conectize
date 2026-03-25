'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  FINALIZED_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from '@/lib/orders/order-status'

const OPEN_STATUS_OPTIONS = OPEN_ORDER_STATUSES.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value] ?? value,
}))

const CLOSED_STATUS_OPTIONS = FINALIZED_ORDER_STATUSES.map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value] ?? value,
}))

export type StatusGroup = 'open' | 'closed' | ''

export function useRelatorioServicosFilters () {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const statusGroup = (searchParams?.get('statusGroup') || '') as StatusGroup
  const statusParam = searchParams?.getAll('status') ?? []
  const selectedStatuses = Array.isArray(statusParam)
    ? statusParam
    : [statusParam].filter(Boolean)

  const statusOptions =
    statusGroup === 'open'
      ? OPEN_STATUS_OPTIONS
      : statusGroup === 'closed'
        ? CLOSED_STATUS_OPTIONS
        : [...OPEN_STATUS_OPTIONS, ...CLOSED_STATUS_OPTIONS]

  function updateParams (updates: {
    statusGroup?: StatusGroup
    status?: string[]
  }) {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (updates.statusGroup !== undefined) {
      if (updates.statusGroup) params.set('statusGroup', updates.statusGroup)
      else params.delete('statusGroup')
    }
    if (updates.status !== undefined) {
      params.delete('status')
      for (const s of updates.status) {
        if (s) params.append('status', s)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return {
    statusGroup,
    selectedStatuses,
    statusOptions,
    updateParams,
  }
}
