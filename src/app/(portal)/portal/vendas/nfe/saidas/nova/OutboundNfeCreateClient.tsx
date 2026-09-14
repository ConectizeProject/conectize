'use client'

import { FileText, Loader2, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { fiscalDocumentStatusBadgeVariant, fiscalDocumentStatusLabel } from '@/lib/fiscal/document-status'
import { emitSalesOrderFiscalDocument } from '@/lib/fiscal/emit-sales-order-client'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  createStandaloneSalesOrder,
  salesOrderNfeEmitHref,
} from '@/lib/sales-orders/create-standalone-client'
import { maskedFromCents } from '@/lib/utils/money'

type PaidOrder = {
  id: string
  order_number: number
  customer_name: string | null
  customer_document: string | null
  total_cents: number
  created_at: string
  nfe_status?: 'pending' | 'authorized' | 'rejected' | 'canceled' | 'denied' | null
  nfe_document_id?: string | null
}

function formatDate (value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function emitLabel (order: PaidOrder) {
  if (order.nfe_status === 'rejected' || order.nfe_status === 'denied') return 'Corrigir NF-e'
  if (order.nfe_status === 'pending') return 'Continuar NF-e'
  return 'Gerar NF-e'
}

export function OutboundNfeCreateClient () {
  const router = useRouter()
  const [orders, setOrders] = useState<PaidOrder[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  async function createFromScratch () {
    if (isCreating) return
    setIsCreating(true)
    try {
      const result = await createStandaloneSalesOrder()
      if (result.ok === false) {
        toast({
          title: 'Não foi possível criar a NF-e',
          description: result.message,
          variant: 'destructive',
        })
        return
      }
      router.push(salesOrderNfeEmitHref(result.orderId))
    } finally {
      setIsCreating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await portalFetch('/api/portal/sales-orders?status=paid')
        const data = await res?.json().catch(() => null)
        if (cancelled) return
        const rows = Array.isArray(data?.orders) ? data.orders as PaidOrder[] : []
        setOrders(rows.filter((order) => order.nfe_status !== 'authorized'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return orders
    return orders.filter((order) => {
      const number = String(order.order_number)
      const name = String(order.customer_name || '').toLowerCase()
      const document = String(order.customer_document || '')
      return number.includes(term) || name.includes(term) || document.includes(term)
    })
  }, [orders, query])

  async function emitNfe (order: PaidOrder) {
    if (busyId) return
    setBusyId(order.id)
    try {
      const result = await emitSalesOrderFiscalDocument({
        orderId: order.id,
        model: '55',
        paid: true,
        navigate: (href) => router.push(href),
      })
      if (result.fiscalDocument) {
        setOrders((prev) => prev
          .map((row) => (
            row.id === order.id
              ? {
                ...row,
                nfe_status: result.fiscalDocument?.status ?? row.nfe_status,
                nfe_document_id: result.fiscalDocument?.id ?? row.nfe_document_id,
              }
              : row
          ))
          .filter((row) => row.nfe_status !== 'authorized'))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>Nova NF-e de saída</h2>
          <p className='text-sm text-muted-foreground'>
            Monte a venda do zero (cliente, produtos e pagamento) ou emita a partir de um pedido já pago. O destinatário precisa de CPF/CNPJ e endereço completo.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link href='/portal/vendas/nfe'>
            <Button type='button' variant='outline'>Voltar</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Criar NF-e do zero</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            Selecione ou cadastre o cliente (com CPF/CNPJ e endereço), inclua os produtos, informe o pagamento e finalize para emitir a NF-e.
          </p>
          <Button type='button' disabled={isCreating} onClick={() => void createFromScratch()}>
            <Plus className='mr-1 h-4 w-4' />
            {isCreating ? 'Criando...' : 'Começar NF-e do zero'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='space-y-3 pb-3'>
          <CardTitle className='text-base'>Ou emitir de um pedido pago</CardTitle>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Buscar por número, cliente ou documento'
              className='pl-9'
              aria-label='Buscar pedido para emitir NF-e'
            />
          </div>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>NF-e</TableHead>
                <TableHead className='text-right'>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='py-8 text-center text-muted-foreground'>
                    {orders.length === 0
                      ? 'Nenhum pedido pago sem NF-e. Finalize uma venda em Pedidos ou no PDV.'
                      : 'Nenhum pedido corresponde à busca.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((order) => {
                  const isBusy = busyId === order.id
                  return (
                    <TableRow key={order.id}>
                      <TableCell className='font-medium'>
                        <Link
                          href={`/portal/vendas/${encodeURIComponent(order.id)}`}
                          className='text-primary underline-offset-4 hover:underline'
                        >
                          #{order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p>{order.customer_name || 'Consumidor final'}</p>
                        {order.customer_document ? (
                          <p className='text-xs text-muted-foreground'>{order.customer_document}</p>
                        ) : (
                          <p className='text-xs text-muted-foreground'>Sem CPF/CNPJ</p>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>{formatDate(order.created_at)}</TableCell>
                      <TableCell className='font-medium'>{maskedFromCents(order.total_cents)}</TableCell>
                      <TableCell>
                        {order.nfe_status ? (
                          <Badge variant={fiscalDocumentStatusBadgeVariant(order.nfe_status)}>
                            {fiscalDocumentStatusLabel(order.nfe_status, '55')}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          type='button'
                          size='sm'
                          disabled={Boolean(busyId)}
                          onClick={() => void emitNfe(order)}
                        >
                          {isBusy
                            ? <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                            : <FileText className='mr-1 h-4 w-4' />}
                          {isBusy ? 'Emitindo...' : emitLabel(order)}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
