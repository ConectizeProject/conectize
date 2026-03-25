'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OrdemCard } from './OrdemCard'
import { portalFetch } from '@/lib/portal/portal-fetch'
import type { PortalOrdensListRow } from './ordens-list-types'

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
  const [open, setOpen] = useState(defaultOpen)
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
    if (defaultOpen && !hasFetched && !isLoading) {
      setOpen(true)
      fetchFinal()
    }
  }, [defaultOpen, hasFetched, isLoading, fetchFinal])

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) fetchFinal()
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex w-full bg-card items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_0.6rem_rgba(74,222,128,0.9)]" aria-hidden />
          <span>Finalizadas / Canceladas</span>
          {hasFetched && !isLoading && (
            <span className="text-xs font-normal text-muted-foreground">({orders.length})</span>
          )}
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 && hasFetched ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma ordem com status final.</p>
          ) : orders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {orders.map((order) => (
                <OrdemCard key={order.id} order={order} />
              ))}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
