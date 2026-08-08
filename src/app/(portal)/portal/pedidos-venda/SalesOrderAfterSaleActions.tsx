'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Printer, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { toast } from '@/hooks/use-toast'
import {
  SalesOrderCupomPreview,
  openSalesOrderCupomPrint,
  salesOrderCupomPrintLabel,
} from '@/app/(portal)/portal/pedidos-venda/SalesOrderCupomPrint'

export { openSalesOrderCupomPrint, salesOrderCupomPrintLabel }

export type SalesOrderBlingLinkState = {
  blingPedidoId: string | null
  blingNfceId: string | null
  preferredUrl: string | null
  pedidoUrl: string | null
  nfceUrl: string | null
  nfceGenerated?: boolean
  nfceError?: string | null
}

type SalesOrderAfterSaleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  orderNumber: number | string | null
  /** Checkout ainda em andamento — exibe ações de cupom desabilitadas. */
  saving?: boolean
  error?: string | null
  initialBling?: SalesOrderBlingLinkState | null
  onDone?: () => void
}

function buildInitialBlingState (props: {
  blingPedidoId?: string | null
  blingNfceId?: string | null
}): SalesOrderBlingLinkState {
  const blingPedidoId = props.blingPedidoId ?? null
  const blingNfceId = props.blingNfceId ?? null
  const pedidoUrl = blingPedidoId
    ? `https://www.bling.com.br/vendas.php#edit/${blingPedidoId}`
    : null
  const nfceUrl = blingNfceId
    ? `https://www.bling.com.br/notas.fiscais.php#edit/${blingNfceId}`
    : null
  return {
    blingPedidoId,
    blingNfceId,
    preferredUrl: nfceUrl || pedidoUrl,
    pedidoUrl,
    nfceUrl,
  }
}

export function SalesOrderAfterSaleActions (props: {
  orderId: string
  orderNumber?: number | string | null
  status?: string | null
  blingPedidoId?: string | null
  blingNfceId?: string | null
  className?: string
  /** Se informado, imprime o iframe embutido em vez de abrir o modal global. */
  onPrintCupom?: () => boolean
  onBlingUpdated?: (state: SalesOrderBlingLinkState) => void
}) {
  const [busyPrint, setBusyPrint] = useState(false)
  const [busyBling, setBusyBling] = useState(false)
  const [bling, setBling] = useState<SalesOrderBlingLinkState>(() =>
    buildInitialBlingState(props)
  )

  useEffect(() => {
    setBling(buildInitialBlingState(props))
  }, [props.blingPedidoId, props.blingNfceId, props.orderId])

  const isPaid = props.status === 'paid' || props.status == null
  const canSendBling = props.status === 'paid' || props.status == null
  const viewUrl = bling.preferredUrl || bling.pedidoUrl

  async function handlePrint () {
    setBusyPrint(true)
    try {
      if (props.onPrintCupom) {
        props.onPrintCupom()
      } else {
        openSalesOrderCupomPrint(props.orderId, { autoPrint: true })
      }
    } finally {
      window.setTimeout(() => setBusyPrint(false), 400)
    }
  }

  async function handleSendToBling () {
    setBusyBling(true)
    try {
      const res = await portalFetch(
        `/api/portal/sales-orders/${encodeURIComponent(props.orderId)}/send-to-bling`,
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

      const next: SalesOrderBlingLinkState = {
        blingPedidoId: data.bling_pedido_id ?? null,
        blingNfceId: data.bling_nfce_id ?? null,
        preferredUrl: data.preferred_url ?? null,
        pedidoUrl: data.pedido_url ?? null,
        nfceUrl: data.nfce_url ?? null,
        nfceGenerated: Boolean(data.nfce_generated),
        nfceError: data.nfce_error ?? null,
      }
      setBling(next)
      props.onBlingUpdated?.(next)

      if (data.already_synced) {
        toast({
          title: 'Pedido já vinculado ao Bling',
          description: 'Abrindo no Bling.',
        })
      } else if (data.nfce_generated) {
        toast({
          title: 'Pedido enviado ao Bling',
          description: 'Rascunho de NFC-e gerado. Confira e autorize no Bling.',
        })
      } else {
        toast({
          title: 'Pedido enviado ao Bling',
          description: data.nfce_error
            ? 'Pedido criado. Gere a NFC-e no painel do Bling.'
            : 'Pedido criado. Abra no Bling para gerar a NFC-e.',
        })
      }

      const url = next.preferredUrl || next.pedidoUrl
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusyBling(false)
    }
  }

  return (
    <div className={props.className || 'flex flex-wrap gap-2'}>
      <Button type='button' variant='outline' disabled={busyPrint} onClick={() => void handlePrint()}>
        {busyPrint ? <Loader2 className='h-4 w-4 animate-spin' /> : <Printer className='h-4 w-4' />}
        <span className='ml-2'>Imprimir cupom</span>
      </Button>

      {canSendBling ? (
        viewUrl ? (
          <Button type='button' variant='default' asChild>
            <a href={viewUrl} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='h-4 w-4' />
              <span className='ml-2'>
                {bling.blingNfceId ? 'Ver NFC-e no Bling' : 'Ver pedido no Bling'}
              </span>
            </a>
          </Button>
        ) : (
          <Button type='button' disabled={busyBling || !isPaid} onClick={() => void handleSendToBling()}>
            {busyBling ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
            <span className='ml-2'>Enviar ao Bling</span>
          </Button>
        )
      ) : null}
    </div>
  )
}

export function SalesOrderAfterSaleDialog ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  saving = false,
  error = null,
  initialBling,
  onDone,
}: SalesOrderAfterSaleDialogProps) {
  const [bling, setBling] = useState<SalesOrderBlingLinkState | null>(initialBling ?? null)
  const printRef = useRef<(() => boolean) | null>(null)
  const isReady = Boolean(orderId) && !saving && !error

  useEffect(() => {
    if (open) setBling(initialBling ?? null)
  }, [open, initialBling])

  function handleClose () {
    if (saving) return
    onOpenChange(false)
    onDone?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className='sm:max-w-md'
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {error
              ? 'Não foi possível finalizar'
              : saving
                ? (orderNumber != null ? `Finalizando pedido #${orderNumber}` : 'Finalizando pedido')
                : `Pedido ${orderNumber != null ? `#${orderNumber}` : ''} finalizado`}
          </DialogTitle>
          <DialogDescription>
            {error
              ? error
              : saving
                ? 'Salvando a venda em segundo plano. A impressão será liberada em instantes.'
                : 'O cupom será enviado à impressora automaticamente. Você também pode imprimir de novo ou enviar ao Bling.'}
          </DialogDescription>
        </DialogHeader>

        {error ? null : isReady && orderId ? (
          <div className='space-y-3'>
            <SalesOrderCupomPreview
              orderId={orderId}
              autoPrint
              onPrintReady={(print) => {
                printRef.current = print
              }}
            />
            <SalesOrderAfterSaleActions
              orderId={orderId}
              orderNumber={orderNumber}
              status='paid'
              blingPedidoId={bling?.blingPedidoId}
              blingNfceId={bling?.blingNfceId}
              onPrintCupom={() => Boolean(printRef.current?.())}
              onBlingUpdated={setBling}
            />
            {bling?.nfceError ? (
              <p className='text-sm text-muted-foreground'>
                A geração automática da NFC-e não concluiu. Abra o pedido no Bling e gere a nota por lá.
              </p>
            ) : null}
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-6 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
              Preparando cupom…
            </div>
            <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
              <Button type='button' variant='outline' disabled className='justify-start'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='ml-2'>Imprimir cupom</span>
              </Button>
              <Button type='button' disabled className='justify-start'>
                <Send className='h-4 w-4' />
                <span className='ml-2'>Enviar ao Bling</span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type='button'
            variant='secondary'
            onClick={handleClose}
            disabled={saving}
          >
            {error ? 'Voltar' : 'Nova venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
