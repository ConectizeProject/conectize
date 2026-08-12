'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { toast } from '@/hooks/use-toast'
import { appConfirm, appPrompt } from '@/lib/ui/app-dialogs'
import { SalesOrderAfterSaleActions } from '@/app/(portal)/portal/pedidos-venda/SalesOrderAfterSaleActions'

type OrderDetail = {
  id: string
  order_number: number
  status: string
  customer_name: string | null
  customer_type: string | null
  customer_document: string | null
  subtotal_cents: number
  discount_total_cents: number
  total_cents: number
  paid_amount_cents: number
  change_cents: number
  bling_pedido_id?: string | null
  bling_nfce_id?: string | null
  created_at: string
  updated_at: string
}

type OrderItem = {
  id: string
  quantity: number
  unit_price_cents: number
  discount_cents: number
  subtotal_cents: number
  products?: { name?: string, sku?: string | null } | null
}

type OrderPayment = {
  id: string
  payment_method_type: string
  amount_cents: number
  status: string
}

function statusLabel (status: string) {
  if (status === 'in_progress') return 'Em andamento'
  if (status === 'paid') return 'Pago'
  if (status === 'canceled') return 'Cancelado'
  return status
}

export default function PedidoVendaDetailPage () {
  const params = useParams()
  const router = useRouter()
  const orderId = String(params.id || '')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<OrderPayment[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load () {
      const res = await portalFetch(`/api/portal/sales-orders/${orderId}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok) {
        setOrder(data.order)
        setItems(data.items ?? [])
        setPayments(data.payments ?? [])
      }
    }
    if (orderId) void load()
  }, [orderId])

  async function cancelOrder () {
    if (!order) return
    const isPaid = order.status === 'paid'
    let reason = 'Cancelado no detalhe do pedido'
    if (isPaid) {
      const typed = await appPrompt({
        title: 'Estornar venda paga',
        description: 'Estoque e financeiro serão revertidos.',
        label: 'Motivo do estorno',
        required: true,
        destructive: true,
        confirmLabel: 'Estornar',
      })
      if (typed == null) return
      reason = typed
    } else if (!(await appConfirm({
      title: `Cancelar o pedido #${order.order_number}?`,
      confirmLabel: 'Cancelar',
      destructive: true,
    }))) {
      return
    }

    setBusy(true)
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
      setOrder((prev) => prev ? { ...prev, status: 'canceled' } : prev)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!order) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        Carregando pedido...
      </div>
    )
  }

  const docFormatted = order.customer_document
    ? formatCpfCnpj(order.customer_document)
    : '—'

  return (
    <div className='space-y-4 py-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>Pedido #{order.order_number}</h1>
          <Badge className='mt-1' variant={order.status === 'paid' ? 'secondary' : order.status === 'canceled' ? 'destructive' : 'default'}>
            {statusLabel(order.status)}
          </Badge>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <SalesOrderAfterSaleActions
            orderId={order.id}
            orderNumber={order.order_number}
            status={order.status}
            blingPedidoId={order.bling_pedido_id}
            blingNfceId={order.bling_nfce_id}
            onBlingUpdated={(bling) => {
              setOrder((prev) => prev
                ? {
                  ...prev,
                  bling_pedido_id: bling.blingPedidoId,
                  bling_nfce_id: bling.blingNfceId,
                }
                : prev)
            }}
          />
          {order.status === 'paid' || order.status === 'in_progress' ? (
            <Button
              type='button'
              variant='outline'
              className='text-destructive hover:text-destructive'
              disabled={busy}
              onClick={() => void cancelOrder()}
            >
              {order.status === 'paid' ? 'Estornar venda' : 'Cancelar pedido'}
            </Button>
          ) : null}
          <Link href='/portal/pedidos-venda'><Button variant='outline'>Voltar</Button></Link>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className='space-y-1 text-sm'>
            <p><strong>Nome:</strong> {order.customer_name || 'Consumidor Final'}</p>
            <p><strong>Tipo:</strong> {(order.customer_type === 'pj' || order.customer_type === 'pessoa_juridica') ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
            <p><strong>Documento:</strong> {docFormatted}</p>
            <p><strong>Criado em:</strong> {new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totais</CardTitle></CardHeader>
          <CardContent className='space-y-1 text-sm'>
            <p><strong>Subtotal:</strong> {maskedFromCents(order.subtotal_cents)}</p>
            <p><strong>Desconto:</strong> {maskedFromCents(order.discount_total_cents)}</p>
            <p><strong>Total:</strong> {maskedFromCents(order.total_cents)}</p>
            <p><strong>Pago:</strong> {maskedFromCents(order.paid_amount_cents)}</p>
            <p><strong>Troco:</strong> {maskedFromCents(order.change_cents)}</p>
            {order.bling_pedido_id ? (
              <p><strong>Bling:</strong> pedido #{order.bling_pedido_id}{order.bling_nfce_id ? ` · NFC-e #${order.bling_nfce_id}` : ''}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
        <CardContent className='divide-y'>
          {items.map((item) => (
            <div key={item.id} className='flex items-center justify-between py-2 text-sm'>
              <div>
                <span className='font-medium'>{item.products?.name || 'Produto'}</span>
                {item.products?.sku ? <span className='ml-2 text-muted-foreground'>({item.products.sku})</span> : null}
                <span className='ml-2 text-muted-foreground'>× {item.quantity}</span>
              </div>
              <span>{maskedFromCents(item.subtotal_cents)}</span>
            </div>
          ))}
          {items.length === 0 ? <p className='py-4 text-muted-foreground'>Sem itens</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pagamentos</CardTitle></CardHeader>
        <CardContent className='divide-y'>
          {payments.map((payment) => (
            <div key={payment.id} className='flex items-center justify-between py-2 text-sm'>
              <span className='capitalize'>{payment.payment_method_type}</span>
              <span>{maskedFromCents(payment.amount_cents)}</span>
            </div>
          ))}
          {payments.length === 0 ? <p className='py-4 text-muted-foreground'>Sem pagamentos</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
