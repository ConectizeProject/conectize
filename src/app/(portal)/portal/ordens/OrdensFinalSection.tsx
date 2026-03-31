'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DragScrollRow } from './DragScrollRow'
import { OrdemCard } from './OrdemCard'
import { portalFetch } from '@/lib/portal/portal-fetch'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
  q?: string
  cpf?: string
  osNumber?: string
  status?: string
  customerId?: string
  customerName?: string
  deviceModelId?: string
  createdFrom?: string
  createdTo?: string
  readyFrom?: string
  readyTo?: string
  defaultOpen?: boolean
}

export function OrdensFinalSection({
  q = '',
  cpf = '',
  osNumber = '',
  status = '',
  customerId = '',
  customerName = '',
  deviceModelId = '',
  createdFrom = '',
  createdTo = '',
  readyFrom = '',
  readyTo = '',
  defaultOpen = false,
}: Props) {
  const [orders, setOrders] = useState<PortalOrdensListRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchFinal = useCallback(() => {
    if (hasFetched) return
    setHasFetched(true)
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set('statusGroup', 'final')
    if (q) params.set('q', q)
    if (cpf) params.set('cpf', cpf)
    if (osNumber) params.set('osNumber', osNumber)
    if (status) params.set('status', status)
    if (customerId) params.set('customerId', customerId)
    if (customerName) params.set('customerName', customerName)
    if (deviceModelId) params.set('deviceModelId', deviceModelId)
    if (createdFrom) params.set('createdFrom', createdFrom)
    if (createdTo) params.set('createdTo', createdTo)
    if (readyFrom) params.set('readyFrom', readyFrom)
    if (readyTo) params.set('readyTo', readyTo)
    portalFetch(`/api/portal/ordens?${params.toString()}`)
      .then((res) => res?.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.orders)) {
          setOrders(data.orders as PortalOrdensListRow[])
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setIsLoading(false))
  }, [hasFetched, q, cpf, osNumber, status, customerId, customerName, deviceModelId, createdFrom, createdTo, readyFrom, readyTo])

  useEffect(() => {
    if (!defaultOpen || hasFetched) return
    const t = window.setTimeout(() => {
      fetchFinal()
    }, 0)
    return () => window.clearTimeout(t)
  }, [defaultOpen, hasFetched, fetchFinal])

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-sm font-medium">
        <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_0.6rem_rgba(74,222,128,0.9)]" aria-hidden />
        <span>Finalizadas / Canceladas</span>
        {hasFetched && !isLoading ? (
          <span className="text-xs font-normal text-muted-foreground">({orders.length})</span>
        ) : null}
      </div>

      {!hasFetched ? (
        <div className="mb-5 px-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchFinal}
            disabled={isLoading}
          >
            {isLoading ? 'Carregando…' : 'Carregar finalizadas/canceladas'}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 && hasFetched ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">Nenhuma ordem com status final.</p>
      ) : orders.length > 0 ? (
        <DragScrollRow>
          {orders.map((order) => (
            <OrdemCard key={order.id} order={order} />
          ))}
        </DragScrollRow>
      ) : null}
    </section>
  )
}
