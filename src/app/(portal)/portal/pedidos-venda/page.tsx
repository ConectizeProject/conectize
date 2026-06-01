'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

type SalesOrder = {
  id: string
  order_number: number
  status: 'in_progress' | 'paid' | 'canceled'
  seller_user_id: string
  customer_name: string | null
  total_cents: number
  paid_amount_cents: number
  change_cents: number
  created_at: string
}

function statusLabel (status: SalesOrder['status']) {
  if (status === 'in_progress') return 'Em andamento'
  if (status === 'paid') return 'Pago'
  return 'Cancelado'
}

export default function PedidosVendaPage () {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [orders, setOrders] = useState<SalesOrder[]>([])

  async function load () {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (status) params.set('status', status)
    const res = await portalFetch(`/api/portal/sales-orders?${params.toString()}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.orders)) setOrders(data.orders)
    else setOrders([])
  }

  useEffect(() => { void load() }, [])

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Pedidos de venda</h1>
        <Link href='/portal/pdv'><Button variant='outline'>Frente de Caixa</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-4'>
          <Input type='date' value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type='date' value={to} onChange={(e) => setTo(e.target.value)} />
          <select className='h-10 rounded border bg-background px-2 text-sm' value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value=''>Todos</option>
            <option value='in_progress'>Em andamento</option>
            <option value='paid'>Pago</option>
            <option value='canceled'>Cancelado</option>
          </select>
          <Button onClick={() => void load()}>Aplicar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className='divide-y'>
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/portal/pedidos-venda/${order.id}`}
              className='flex items-center justify-between py-3 text-sm hover:bg-accent'
            >
              <div>
                <span className='font-medium'>Pedido #{order.order_number}</span>
                <span className='ml-2 text-muted-foreground'>{order.customer_name || 'Consumidor Final'}</span>
                <span className='ml-2 text-muted-foreground'>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Badge variant={order.status === 'paid' ? 'secondary' : order.status === 'canceled' ? 'destructive' : 'default'}>
                  {statusLabel(order.status)}
                </Badge>
                <span className='font-medium'>{maskedFromCents(order.total_cents)}</span>
              </div>
            </Link>
          ))}
          {orders.length === 0 ? <p className='py-6 text-sm text-muted-foreground'>Nenhum pedido encontrado.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
