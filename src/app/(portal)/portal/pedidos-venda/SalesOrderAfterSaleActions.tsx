'use client'

import { useEffect, useState } from 'react'
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
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { toast } from '@/hooks/use-toast'

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
  initialBling?: SalesOrderBlingLinkState | null
  onDone?: () => void
}

export function openSalesOrderCupomPrint (orderId: string) {
  const url = `/api/portal/sales-orders/${encodeURIComponent(orderId)}/print`
  window.open(url, '_blank', getPrintWindowFeatures())
}

export function salesOrderCupomPrintLabel (status?: string | null) {
  return status === 'paid' ? 'Reimprimir cupom' : 'Imprimir cupom'
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
  /** Força o rótulo "Reimprimir" mesmo fora de status paid (ex.: 2ª vez no diálogo). */
  reprint?: boolean
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
  const printLabel = props.reprint || props.status === 'paid'
    ? 'Reimprimir cupom'
    : 'Imprimir cupom'

  async function handlePrint () {
    setBusyPrint(true)
    try {
      openSalesOrderCupomPrint(props.orderId)
    } finally {
      setBusyPrint(false)
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
        <span className='ml-2'>{printLabel}</span>
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
  initialBling,
  onDone,
}: SalesOrderAfterSaleDialogProps) {
  const [bling, setBling] = useState<SalesOrderBlingLinkState | null>(initialBling ?? null)

  useEffect(() => {
    if (open) setBling(initialBling ?? null)
  }, [open, initialBling])

  function handleClose () {
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
      <DialogContent aria-describedby={undefined} className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            Pedido {orderNumber != null ? `#${orderNumber}` : ''} finalizado
          </DialogTitle>
          <DialogDescription>
            Imprima o cupom agora ou reimprima depois pelo PDV / Pedidos de venda. Também pode enviar ao Bling para NFC-e.
          </DialogDescription>
        </DialogHeader>

        {orderId ? (
          <div className='space-y-3'>
            <SalesOrderAfterSaleActions
              orderId={orderId}
              orderNumber={orderNumber}
              status='paid'
              blingPedidoId={bling?.blingPedidoId}
              blingNfceId={bling?.blingNfceId}
              onBlingUpdated={setBling}
            />
            {bling?.nfceError ? (
              <p className='text-sm text-muted-foreground'>
                A geração automática da NFC-e não concluiu. Abra o pedido no Bling e gere a nota por lá.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Nova venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
