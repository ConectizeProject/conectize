'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Printer, Send, Ban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import {
  openSalesOrderCupomPrint,
  salesOrderCupomPrintLabel,
} from '@/app/(portal)/portal/pedidos-venda/SalesOrderAfterSaleActions'

type SalesOrder = {
  id: string
  order_number: number
  status: 'in_progress' | 'paid' | 'canceled'
  seller_user_id: string
  customer_name: string | null
  total_cents: number
  paid_amount_cents: number
  change_cents: number
  bling_pedido_id?: string | null
  bling_nfce_id?: string | null
  created_at: string
}

type TeamUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

function statusLabel (status: SalesOrder['status']) {
  if (status === 'in_progress') return 'Em andamento'
  if (status === 'paid') return 'Pago'
  return 'Cancelado'
}

function teamUserLabel (user: TeamUser) {
  return String(user.full_name || user.email || 'Usuário').trim()
}

function blingViewUrl (order: SalesOrder) {
  if (order.bling_nfce_id) {
    return `https://www.bling.com.br/notas.fiscais.php#edit/${order.bling_nfce_id}`
  }
  if (order.bling_pedido_id) {
    return `https://www.bling.com.br/vendas.php#edit/${order.bling_pedido_id}`
  }
  return null
}

export default function PedidosVendaPage () {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [sellerUserId, setSellerUserId] = useState('')
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadTeamUsers () {
    const res = await portalFetch('/api/portal/team-users')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.users)) {
      setTeamUsers(data.users as TeamUser[])
      return
    }
    setTeamUsers([])
  }

  async function load () {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (status) params.set('status', status)
    if (sellerUserId) params.set('seller_user_id', sellerUserId)
    const res = await portalFetch(`/api/portal/sales-orders?${params.toString()}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.orders)) setOrders(data.orders)
    else setOrders([])
  }

  useEffect(() => {
    void loadTeamUsers()
    void load()
  }, [])

  function sellerNameFor (sellerId: string) {
    const user = teamUsers.find((row) => row.id === sellerId)
    if (!user) return null
    return teamUserLabel(user)
  }

  async function sendToBling (order: SalesOrder) {
    setBusyId(order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(order.id)}/send-to-bling`,
        { method: 'POST' }
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: 'Erro ao enviar ao Bling',
          description: data?.message || data?.error || 'Não foi possível enviar o pedido.',
          variant: 'destructive',
        })
        return
      }

      setOrders((prev) => prev.map((row) => (
        row.id === order.id
          ? {
            ...row,
            bling_pedido_id: data.bling_pedido_id ?? row.bling_pedido_id,
            bling_nfce_id: data.bling_nfce_id ?? row.bling_nfce_id,
          }
          : row
      )))

      toast({
        title: data.already_synced ? 'Pedido já vinculado ao Bling' : 'Pedido enviado ao Bling',
        description: data.nfce_generated
          ? 'Rascunho de NFC-e gerado. Confira no Bling.'
          : 'Abra no Bling para gerar/autorizar a NFC-e.',
      })

      const url = data.preferred_url || data.pedido_url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelOrder (order: SalesOrder) {
    const isPaid = order.status === 'paid'
    let reason = 'Cancelado na lista de pedidos'
    if (isPaid) {
      const typed = window.prompt('Motivo do estorno da venda paga:')
      if (typed == null) return
      reason = typed.trim()
      if (!reason) {
        toast({ title: 'Informe o motivo do estorno', variant: 'destructive' })
        return
      }
      if (!confirm('Estornar esta venda paga? Estoque e financeiro serão revertidos.')) return
    } else if (!confirm(`Cancelar o pedido #${order.order_number}?`)) {
      return
    }

    setBusyId(order.id)
    try {
      const res = await portalFetch(`/api/portal/sales-orders/${encodeURIComponent(order.id)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao cancelar',
          variant: 'destructive',
        })
        return
      }
      toast({
        title: isPaid ? 'Venda estornada' : 'Pedido cancelado',
        description: data.bling_warning || undefined,
      })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>Pedidos de venda</h1>
        <Link href='/portal/pdv'><Button variant='outline'>Frente de Caixa</Button></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          <Input type='date' value={from} onChange={(e) => setFrom(e.target.value)} aria-label='Data inicial' />
          <Input type='date' value={to} onChange={(e) => setTo(e.target.value)} aria-label='Data final' />
          <select
            className='h-10 rounded border bg-background px-2 text-sm'
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label='Status'
          >
            <option value=''>Todos os status</option>
            <option value='in_progress'>Em andamento</option>
            <option value='paid'>Pago</option>
            <option value='canceled'>Cancelado</option>
          </select>
          <select
            className='h-10 rounded border bg-background px-2 text-sm'
            value={sellerUserId}
            onChange={(e) => setSellerUserId(e.target.value)}
            aria-label='Vendedor'
          >
            <option value=''>Todos os vendedores</option>
            {teamUsers.map((user) => (
              <option key={user.id} value={user.id}>{teamUserLabel(user)}</option>
            ))}
          </select>
          <Button onClick={() => void load()}>Aplicar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className='divide-y'>
          {orders.map((order) => {
            const viewUrl = blingViewUrl(order)
            const sellerName = sellerNameFor(order.seller_user_id)
            return (
              <div
                key={order.id}
                className='flex flex-wrap items-center justify-between gap-2 py-3 text-sm'
              >
                <Link
                  href={`/portal/pedidos-venda/${order.id}`}
                  className='min-w-0 flex-1 hover:underline'
                >
                  <span className='font-medium'>Pedido #{order.order_number}</span>
                  <span className='ml-2 text-muted-foreground'>{order.customer_name || 'Consumidor Final'}</span>
                  {sellerName ? (
                    <span className='ml-2 text-muted-foreground'>· {sellerName}</span>
                  ) : null}
                  <span className='ml-2 text-muted-foreground'>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
                </Link>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant={order.status === 'paid' ? 'secondary' : order.status === 'canceled' ? 'destructive' : 'default'}>
                    {statusLabel(order.status)}
                  </Badge>
                  <span className='font-medium'>{maskedFromCents(order.total_cents)}</span>
                  {order.status === 'paid' || order.status === 'in_progress' ? (
                    <>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => openSalesOrderCupomPrint(order.id)}
                      >
                        <Printer className='h-3.5 w-3.5' />
                        <span className='ml-1'>{salesOrderCupomPrintLabel(order.status)}</span>
                      </Button>
                      {order.status === 'paid' ? (
                        viewUrl ? (
                          <Button type='button' size='sm' variant='outline' asChild>
                            <a href={viewUrl} target='_blank' rel='noopener noreferrer'>
                              <ExternalLink className='h-3.5 w-3.5' />
                              <span className='ml-1'>Bling</span>
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type='button'
                            size='sm'
                            disabled={busyId === order.id}
                            onClick={() => void sendToBling(order)}
                          >
                            <Send className='h-3.5 w-3.5' />
                            <span className='ml-1'>Enviar Bling</span>
                          </Button>
                        )
                      ) : null}
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='text-destructive hover:text-destructive'
                        disabled={busyId === order.id}
                        onClick={() => void cancelOrder(order)}
                      >
                        <Ban className='h-3.5 w-3.5' />
                        <span className='ml-1'>{order.status === 'paid' ? 'Estornar' : 'Cancelar'}</span>
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            )
          })}
          {orders.length === 0 ? <p className='py-6 text-sm text-muted-foreground'>Nenhum pedido encontrado.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
