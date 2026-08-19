'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, ExternalLink, FileCheck2, Loader2, Printer, Send } from 'lucide-react'
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
  isProductFiscalCorrectionError,
  nfceEditorHref,
} from '@/lib/fiscal/product-fiscal-errors'
import {
  SalesOrderCupomPreview,
  openSalesOrderCupomPrint,
  salesOrderCupomPrintLabel,
} from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'

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

type FiscalDocumentState = {
  id: string
  status: 'pending' | 'authorized' | 'rejected' | 'canceled' | 'denied'
  access_key?: string | null
  protocol?: string | null
  sefaz_status_code?: string | null
  sefaz_status_message?: string | null
}

type SalesOrderNfceState = {
  fiscalDocument: FiscalDocumentState | null
  danfeUrl: string | null
  xmlUrl: string | null
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
  const [busyNfce, setBusyNfce] = useState(false)
  const [nfce, setNfce] = useState<SalesOrderNfceState>({ fiscalDocument: null, danfeUrl: null, xmlUrl: null })
  const [bling, setBling] = useState<SalesOrderBlingLinkState>(() =>
    buildInitialBlingState(props)
  )
  const router = useRouter()

  useEffect(() => {
    setBling(buildInitialBlingState(props))
  }, [props.blingPedidoId, props.blingNfceId, props.orderId])

  const isPaid = props.status === 'paid' || props.status == null
  const canSendBling = props.status === 'paid' || props.status == null
  const viewUrl = bling.preferredUrl || bling.pedidoUrl
  const nfceStatus = nfce.fiscalDocument?.status ?? null
  const canPrintFiscal = nfceStatus === 'authorized' && nfce.danfeUrl
  const needsFiscalCorrection = Boolean(
    nfce.fiscalDocument?.id && (
      nfceStatus === 'rejected' ||
      nfceStatus === 'denied' ||
      (nfceStatus === 'pending' && isProductFiscalCorrectionError(nfce.fiscalDocument.sefaz_status_code))
    ),
  )

  useEffect(() => {
    let cancelled = false
    if (!isPaid) {
      setNfce({ fiscalDocument: null, danfeUrl: null, xmlUrl: null })
      return
    }

    void (async () => {
      const res = await portalFetch(`/api/portal/sales-orders/${encodeURIComponent(props.orderId)}/emit-nfce`)
      const data = await res?.json().catch(() => null)
      if (cancelled || !data?.ok) return
      setNfce({
        fiscalDocument: data.fiscal_document ?? null,
        danfeUrl: data.danfe_url ?? null,
        xmlUrl: data.xml_url ?? null,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [isPaid, props.orderId])

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

  async function handleNfce () {
    if (canPrintFiscal && nfce.danfeUrl) {
      window.open(nfce.danfeUrl, '_blank', 'noopener,noreferrer')
      return
    }

    if (needsFiscalCorrection && nfce.fiscalDocument?.id) {
      router.push(nfceEditorHref(nfce.fiscalDocument.id, {
        corrigir: isProductFiscalCorrectionError(nfce.fiscalDocument.sefaz_status_code),
      }))
      return
    }

    setBusyNfce(true)
    try {
      const endpoint = nfce.fiscalDocument?.id && nfce.fiscalDocument.status !== 'authorized'
        ? `/api/portal/fiscal/documents/${encodeURIComponent(nfce.fiscalDocument.id)}/retry`
        : `/api/portal/sales-orders/${encodeURIComponent(props.orderId)}/emit-nfce`
      const res = await portalFetch(endpoint, { method: 'POST' })
      const data = await res?.json().catch(() => null)
      const nextDocument = (data?.fiscal_document ?? null) as FiscalDocumentState | null
      if (!data?.ok) {
        if (data?.needs_correction && nextDocument?.id) {
          toast({
            title: 'Complete NCM e CEST',
            description: data.message || 'Preencha os dados fiscais dos produtos para emitir a NFC-e.',
          })
          router.push(nfceEditorHref(nextDocument.id, { corrigir: true }))
          return
        }
        toast({
          title: 'NFC-e não autorizada',
          description: data?.message || data?.error || 'Não foi possível emitir a NFC-e.',
          variant: 'destructive',
        })
        return
      }

      const next = {
        fiscalDocument: data.fiscal_document ?? null,
        danfeUrl: data.danfe_url ?? null,
        xmlUrl: data.xml_url ?? null,
      }
      setNfce(next)

      if (next.danfeUrl) {
        toast({
          variant: 'success',
          title: data.already_authorized ? 'NFC-e já autorizada' : 'NFC-e autorizada',
          description: 'Abrindo o cupom fiscal para impressão.',
        })
        window.open(next.danfeUrl, '_blank', 'noopener,noreferrer')
        return
      }

      const reason = next.fiscalDocument?.sefaz_status_message
      toast({
        title: 'NFC-e não autorizada',
        description: reason || 'A SEFAZ retornou a nota sem autorização.',
        variant: 'destructive',
      })
      if (next.fiscalDocument?.id) {
        router.push(`/portal/vendas/nfce/${encodeURIComponent(next.fiscalDocument.id)}`)
      }
    } finally {
      setBusyNfce(false)
    }
  }

  return (
    <div className={props.className || 'flex flex-wrap gap-2'}>
      <Button type='button' variant='outline' disabled={busyPrint} onClick={() => void handlePrint()}>
        {busyPrint ? <Loader2 className='h-4 w-4 animate-spin' /> : <Printer className='h-4 w-4' />}
        <span className='ml-2'>Imprimir cupom</span>
      </Button>

      {isPaid ? (
        <Button type='button' variant={canPrintFiscal ? 'outline' : 'secondary'} disabled={busyNfce} onClick={() => void handleNfce()}>
          {busyNfce ? <Loader2 className='h-4 w-4 animate-spin' /> : <FileCheck2 className='h-4 w-4' />}
          <span className='ml-2'>
            {needsFiscalCorrection
              ? 'Completar dados da NFC-e'
              : canPrintFiscal
                ? 'Imprimir cupom fiscal'
                : 'NFC-e + imprimir cupom fiscal'}
          </span>
        </Button>
      ) : null}

      {nfce.xmlUrl ? (
        <Button type='button' variant='outline' asChild>
          <a href={nfce.xmlUrl} download>
            <Download className='h-4 w-4' />
            <span className='ml-2'>Baixar XML</span>
          </a>
        </Button>
      ) : null}

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
      {nfceStatus === 'denied' && nfce.fiscalDocument?.id ? (
        <p className='basis-full text-sm text-destructive'>
          NFC-e denegada.{' '}
          <Link href={`/portal/vendas/nfce/${encodeURIComponent(nfce.fiscalDocument.id)}`} className='underline underline-offset-4'>
            Corrigir e enviar de novo
          </Link>
          {nfce.fiscalDocument.sefaz_status_message ? ` — ${nfce.fiscalDocument.sefaz_status_message}` : ''}
        </p>
      ) : nfceStatus === 'rejected' && nfce.fiscalDocument?.id ? (
        <p className='basis-full text-sm text-destructive'>
          NFC-e rejeitada.{' '}
          <Link href={`/portal/vendas/nfce/${encodeURIComponent(nfce.fiscalDocument.id)}`} className='underline underline-offset-4'>
            Ver erro e corrigir
          </Link>
          {nfce.fiscalDocument.sefaz_status_message ? ` — ${nfce.fiscalDocument.sefaz_status_message}` : ''}
        </p>
      ) : nfceStatus === 'denied' ? (
        <p className='basis-full text-sm text-destructive'>
          NFC-e denegada: o número foi consumido pela SEFAZ. Corrija os dados e emita de novo.
        </p>
      ) : nfceStatus === 'rejected' ? (
        <p className='basis-full text-sm text-destructive'>
          NFC-e rejeitada: {nfce.fiscalDocument?.sefaz_status_message || 'verifique os dados fiscais.'}
        </p>
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
                : 'O cupom será enviado à impressora automaticamente. Você também pode emitir NFC-e ou enviar ao Bling.'}
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
                <FileCheck2 className='h-4 w-4' />
                <span className='ml-2'>NFC-e + imprimir cupom fiscal</span>
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
