'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OrdemCard } from './OrdemCard'
import { portalFetch } from '@/lib/portal/portal-fetch'

type OrderRow = {
  id: string
  display_number: number | null
  status: string
  title: string
  created_at: string
  updated_at: string
  closed_at: string | null
  estimated_ready_at: string | null
  share_token?: string | null
  customers: Record<string, unknown> | null
  device_models: Record<string, unknown> | null
}

type Props = {
  q?: string
  cpf?: string
  osNumber?: string
  status?: string
  defaultOpen?: boolean
}

export function OrdensFinalSection({ q = '', cpf = '', osNumber = '', status = '', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [orders, setOrders] = useState<OrderRow[]>([])
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
    portalFetch(`/api/portal/ordens?${params.toString()}`)
      .then((res) => res?.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.orders)) {
          setOrders(data.orders)
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setIsLoading(false))
  }, [hasFetched, q, cpf, osNumber, status])

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
                <OrdemCard key={order.id} order={order as any} />
              ))}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
