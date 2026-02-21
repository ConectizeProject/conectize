'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderStatusBadge } from './OrderStatusBadge'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'

type OrderRow = {
  id: string
  display_number: string | null
  status: string
  title: string | null
  created_at: string
  updated_at: string
  estimated_ready_at: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  isCreationPage?: boolean
}

export function CustomerOrderHistoryModal({
  open,
  onOpenChange,
  customerId,
  isCreationPage = false,
}: Props) {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Record<string, OrderRow[]>>({})

  useEffect(() => {
    if (!open || !customerId) return

    const cached = cacheRef.current[customerId]
    if (cached !== undefined) {
      setOrders(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    portalFetch(`/api/portal/ordens?customerId=${encodeURIComponent(customerId)}`)
      .then((res) => res?.json())
      .then((data) => {
        if (cancelled) return
        if (data?.ok && Array.isArray(data.orders)) {
          cacheRef.current[customerId] = data.orders
          setOrders(data.orders)
        } else {
          setError(data?.error === 'db_error' ? 'Erro ao carregar ordens.' : 'Não foi possível carregar.')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Erro ao carregar ordens.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, customerId])

  function handleView(orderId: string) {
    onOpenChange(false)
    router.push(`/portal/ordens/${orderId}`)
  }

  function handleClone(orderId: string) {
    onOpenChange(false)
    router.push(`/portal/ordens/nova?duplicate=${orderId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de ordens do cliente
          </DialogTitle>
          <DialogDescription>
            {isCreationPage
              ? 'Use o ícone de olho para abrir a OS ou o ícone de copiar para clonar e criar uma nova OS.'
              : 'Use o ícone de olho para abrir a ordem de serviço.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">{error}</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma ordem de serviço encontrada para este cliente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {order.display_number ?? '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={order.title ?? undefined}>
                      {order.title || '-'}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTimeBr(order.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleView(order.id)}
                          aria-label={`Ver OS ${order.display_number ?? order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isCreationPage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleClone(order.id)}
                            aria-label={`Clonar OS ${order.display_number ?? order.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
