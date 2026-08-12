'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, ExternalLink, MoreHorizontal, Package, Printer, Send, Undo2, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import {
  openSalesOrderCupomPrint,
  salesOrderCupomPrintLabel,
} from '@/app/(portal)/portal/vendas/SalesOrderAfterSaleActions'

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
  has_stock_posted?: boolean
  has_finance_posted?: boolean
}

type TeamUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

type ConfirmKind =
  | 'post_stock'
  | 'reverse_stock'
  | 'post_finance'
  | 'reverse_finance'
  | 'cancel'
  | 'cancel_paid'

type ConfirmState = {
  kind: ConfirmKind
  order: SalesOrder
}

const CONFIRM_COPY: Record<Exclude<ConfirmKind, 'cancel_paid'>, {
  title: string
  description: (order: SalesOrder) => string
  confirmLabel: string
  destructive?: boolean
}> = {
  post_stock: {
    title: 'Lançar estoque',
    description: (order) => `Confirma o lançamento de estoque do pedido #${order.order_number}?`,
    confirmLabel: 'Lançar estoque',
  },
  reverse_stock: {
    title: 'Estornar estoque',
    description: (order) => `Estornar o estoque do pedido #${order.order_number}? A venda permanecerá paga.`,
    confirmLabel: 'Estornar estoque',
    destructive: true,
  },
  post_finance: {
    title: 'Lançar conta',
    description: (order) => `Lançar a conta do pedido #${order.order_number} no financeiro?`,
    confirmLabel: 'Lançar conta',
  },
  reverse_finance: {
    title: 'Estornar conta',
    description: (order) => `Estornar a conta do pedido #${order.order_number}? A venda permanecerá paga.`,
    confirmLabel: 'Estornar conta',
    destructive: true,
  },
  cancel: {
    title: 'Cancelar pedido',
    description: (order) => `Cancelar o pedido #${order.order_number}?`,
    confirmLabel: 'Cancelar pedido',
    destructive: true,
  },
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
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [sellerUserId, setSellerUserId] = useState('')
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

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
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (status) params.set('status', status)
      if (sellerUserId) params.set('seller_user_id', sellerUserId)
      const res = await portalFetch(`/api/portal/sales-orders?${params.toString()}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok && Array.isArray(data.orders)) setOrders(data.orders)
      else setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTeamUsers()
    void load()
  }, [])

  function openConfirm (kind: ConfirmKind, order: SalesOrder) {
    setCancelReason('')
    setConfirmState({ kind, order })
  }

  function closeConfirm () {
    if (isConfirming) return
    setConfirmState(null)
    setCancelReason('')
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

  async function runCancelOrder (order: SalesOrder, reason: string) {
    const isPaid = order.status === 'paid'
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
        return false
      }
      toast({
        title: isPaid ? 'Venda estornada' : 'Pedido cancelado',
        description: data.bling_warning || undefined,
      })
      await load()
      return true
    } finally {
      setBusyId(null)
    }
  }

  async function runReverseStock (order: SalesOrder) {
    setBusyId(order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(order.id)}/reverse-stock`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao estornar estoque',
          variant: 'destructive',
        })
        return false
      }
      toast({ title: 'Estoque estornado' })
      setOrders((prev) => prev.map((row) => (
        row.id === order.id
          ? { ...row, has_stock_posted: false }
          : row
      )))
      return true
    } finally {
      setBusyId(null)
    }
  }

  async function runPostStock (order: SalesOrder) {
    setBusyId(order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(order.id)}/post-stock`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao lançar estoque',
          variant: 'destructive',
        })
        return false
      }
      toast({ title: 'Estoque lançado' })
      setOrders((prev) => prev.map((row) => (
        row.id === order.id
          ? { ...row, has_stock_posted: true }
          : row
      )))
      return true
    } finally {
      setBusyId(null)
    }
  }

  async function runPostFinance (order: SalesOrder) {
    setBusyId(order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(order.id)}/post-finance`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao lançar conta',
          variant: 'destructive',
        })
        return false
      }
      toast({ title: 'Conta lançada' })
      setOrders((prev) => prev.map((row) => (
        row.id === order.id
          ? { ...row, has_finance_posted: true }
          : row
      )))
      return true
    } finally {
      setBusyId(null)
    }
  }

  async function runReverseFinance (order: SalesOrder) {
    setBusyId(order.id)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(order.id)}/reverse-finance`,
        { method: 'POST' },
      )
      const data = await res?.json().catch(() => null)
      if (!data?.ok) {
        toast({
          title: data?.message || data?.error || 'Erro ao estornar conta',
          variant: 'destructive',
        })
        return false
      }
      toast({ title: 'Conta estornada' })
      setOrders((prev) => prev.map((row) => (
        row.id === order.id
          ? { ...row, has_finance_posted: false }
          : row
      )))
      return true
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmAction () {
    if (!confirmState || isConfirming) return
    const { kind, order } = confirmState

    if (kind === 'cancel_paid') {
      const reason = cancelReason.trim()
      if (!reason) {
        toast({ title: 'Informe o motivo do estorno', variant: 'destructive' })
        return
      }
      setIsConfirming(true)
      try {
        const ok = await runCancelOrder(order, reason)
        if (ok) {
          setConfirmState(null)
          setCancelReason('')
        }
      } finally {
        setIsConfirming(false)
      }
      return
    }

    setIsConfirming(true)
    try {
      let ok = false
      if (kind === 'post_stock') ok = await runPostStock(order)
      else if (kind === 'reverse_stock') ok = await runReverseStock(order)
      else if (kind === 'post_finance') ok = await runPostFinance(order)
      else if (kind === 'reverse_finance') ok = await runReverseFinance(order)
      else if (kind === 'cancel') ok = await runCancelOrder(order, 'Cancelado na lista de pedidos')
      if (ok) setConfirmState(null)
    } finally {
      setIsConfirming(false)
    }
  }

  const simpleConfirm = confirmState && confirmState.kind !== 'cancel_paid'
    ? CONFIRM_COPY[confirmState.kind]
    : null

  return (
    <TooltipProvider>
      <div className='space-y-4 py-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-semibold'>Vendas</h1>
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
            <Button onClick={() => void load()} disabled={isLoading}>
              {isLoading ? 'Carregando...' : 'Aplicar'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número do pedido</TableHead>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className='w-12 text-right'>
                    <span className='sr-only'>Opções</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className='py-6 text-center text-muted-foreground'>
                      Carregando vendas...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='py-6 text-center text-muted-foreground'>
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const viewUrl = blingViewUrl(order)
                    const isBusy = busyId === order.id
                    const canAct = order.status === 'paid' || order.status === 'in_progress'

                    return (
                      <TableRow
                        key={order.id}
                        className='cursor-pointer'
                        onClick={() => router.push(`/portal/vendas/${order.id}`)}
                      >
                        <TableCell className='font-medium'>
                          #{order.order_number}
                        </TableCell>
                        <TableCell className='whitespace-nowrap text-muted-foreground'>
                          {new Date(order.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>{order.customer_name || 'Consumidor Final'}</TableCell>
                        <TableCell className='font-medium'>{maskedFromCents(order.total_cents)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'paid'
                                ? 'secondary'
                                : order.status === 'canceled'
                                  ? 'destructive'
                                  : 'default'
                            }
                          >
                            {statusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className='text-right'
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className='inline-flex items-center justify-end gap-0.5'>
                            {order.has_finance_posted ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className='inline-flex h-8 w-8 items-center justify-center text-emerald-600'
                                    aria-label='Conta lançada'
                                  >
                                    <Wallet className='h-4 w-4' />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Conta lançada</TooltipContent>
                              </Tooltip>
                            ) : null}
                            {order.has_stock_posted ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className='inline-flex h-8 w-8 items-center justify-center text-sky-400'
                                    aria-label='Estoque lançado'
                                  >
                                    <Package className='h-4 w-4' />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Estoque lançado</TooltipContent>
                              </Tooltip>
                            ) : null}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon'
                                  className='h-8 w-8'
                                  disabled={isBusy}
                                  aria-label={`Opções do pedido #${order.order_number}`}
                                >
                                  <MoreHorizontal className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end' className='min-w-44'>
                                {canAct ? (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={(event) => {
                                        event.preventDefault()
                                        openSalesOrderCupomPrint(order.id)
                                      }}
                                    >
                                      <Printer className='mr-2 h-4 w-4' />
                                      {salesOrderCupomPrintLabel(order.status)}
                                    </DropdownMenuItem>
                                    {order.status === 'paid' ? (
                                      viewUrl ? (
                                        <DropdownMenuItem asChild>
                                          <a href={viewUrl} target='_blank' rel='noopener noreferrer'>
                                            <ExternalLink className='mr-2 h-4 w-4' />
                                            Abrir no Bling
                                          </a>
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          disabled={isBusy}
                                          onSelect={(event) => {
                                            event.preventDefault()
                                            void sendToBling(order)
                                          }}
                                        >
                                          <Send className='mr-2 h-4 w-4' />
                                          Enviar ao Bling
                                        </DropdownMenuItem>
                                      )
                                    ) : null}
                                    {order.status === 'paid' && !order.has_stock_posted ? (
                                      <DropdownMenuItem
                                        disabled={isBusy}
                                        onSelect={(event) => {
                                          event.preventDefault()
                                          openConfirm('post_stock', order)
                                        }}
                                      >
                                        <Package className='mr-2 h-4 w-4' />
                                        Lançar estoque
                                      </DropdownMenuItem>
                                    ) : null}
                                    {order.status === 'paid' && order.has_stock_posted ? (
                                      <DropdownMenuItem
                                        disabled={isBusy}
                                        onSelect={(event) => {
                                          event.preventDefault()
                                          openConfirm('reverse_stock', order)
                                        }}
                                      >
                                        <Undo2 className='mr-2 h-4 w-4' />
                                        Estornar estoque
                                      </DropdownMenuItem>
                                    ) : null}
                                    {order.status === 'paid' && !order.has_finance_posted ? (
                                      <DropdownMenuItem
                                        disabled={isBusy}
                                        onSelect={(event) => {
                                          event.preventDefault()
                                          openConfirm('post_finance', order)
                                        }}
                                      >
                                        <Wallet className='mr-2 h-4 w-4' />
                                        Lançar conta
                                      </DropdownMenuItem>
                                    ) : null}
                                    {order.status === 'paid' && order.has_finance_posted ? (
                                      <DropdownMenuItem
                                        disabled={isBusy}
                                        onSelect={(event) => {
                                          event.preventDefault()
                                          openConfirm('reverse_finance', order)
                                        }}
                                      >
                                        <Undo2 className='mr-2 h-4 w-4' />
                                        Estornar conta
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className='text-destructive focus:text-destructive'
                                      disabled={isBusy}
                                      onSelect={(event) => {
                                        event.preventDefault()
                                        openConfirm(
                                          order.status === 'paid' ? 'cancel_paid' : 'cancel',
                                          order,
                                        )
                                      }}
                                    >
                                      <Ban className='mr-2 h-4 w-4' />
                                      {order.status === 'paid' ? 'Estornar' : 'Cancelar'}
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem disabled>
                                    Sem ações disponíveis
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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

      <AlertDialog
        open={Boolean(simpleConfirm && confirmState)}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
      >
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{simpleConfirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState && simpleConfirm
                ? simpleConfirm.description(confirmState.order)
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              className={simpleConfirm?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmAction()
              }}
            >
              {isConfirming ? 'Processando...' : (simpleConfirm?.confirmLabel || 'Confirmar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={confirmState?.kind === 'cancel_paid'}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
      >
        <DialogContent
          className='sm:max-w-md'
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Estornar venda paga</DialogTitle>
            <DialogDescription>
              {confirmState
                ? `Estornar o pedido #${confirmState.order.order_number}? Estoque e financeiro serão revertidos.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='cancel-reason'>Motivo do estorno</Label>
            <Textarea
              id='cancel-reason'
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder='Descreva o motivo do estorno'
              rows={3}
              disabled={isConfirming}
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={isConfirming}
              onClick={closeConfirm}
            >
              Voltar
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={isConfirming || !cancelReason.trim()}
              onClick={() => void handleConfirmAction()}
            >
              {isConfirming ? 'Processando...' : 'Estornar venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
