'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function salesOrderCupomPreviewUrl (orderId: string) {
  return `/api/portal/sales-orders/${encodeURIComponent(orderId)}/print?preview=1`
}

export function nfceDanfePreviewUrl (documentId: string) {
  return `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/danfe?preview=1`
}

export function printCupomIframe (iframe: HTMLIFrameElement | null) {
  const win = iframe?.contentWindow
  if (!win) return false
  win.focus()
  win.print()
  return true
}

type HtmlPrintPreviewProps = {
  src: string
  title: string
  errorMessage: string
  autoPrint?: boolean
  className?: string
  onPrintReady?: (print: () => boolean) => void
}

function HtmlPrintPreview ({
  src,
  title,
  errorMessage,
  autoPrint = false,
  className,
  onPrintReady,
}: HtmlPrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const autoPrintedRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const doPrint = useCallback(() => printCupomIframe(iframeRef.current), [])

  useEffect(() => {
    autoPrintedRef.current = false
    setIsLoading(true)
    setHasError(false)
  }, [src])

  useEffect(() => {
    onPrintReady?.(doPrint)
  }, [doPrint, onPrintReady])

  function handleLoad () {
    setIsLoading(false)
    if (!autoPrint || autoPrintedRef.current) return
    autoPrintedRef.current = true
    window.setTimeout(() => {
      doPrint()
    }, 200)
  }

  return (
    <div className={className || 'relative overflow-hidden rounded-md border bg-muted/30'}>
      {isLoading ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/70'>
          <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        </div>
      ) : null}
      {hasError ? (
        <div className='flex min-h-[280px] items-center justify-center p-4 text-center text-sm text-muted-foreground'>
          {errorMessage}
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          key={src}
          title={title}
          src={src}
          className='h-[min(56vh,420px)] w-full border-0 bg-white'
          onLoad={handleLoad}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
        />
      )}
    </div>
  )
}

type SalesOrderCupomPreviewProps = {
  orderId: string
  autoPrint?: boolean
  className?: string
  onPrintReady?: (print: () => boolean) => void
}

export function SalesOrderCupomPreview ({
  orderId,
  autoPrint = false,
  className,
  onPrintReady,
}: SalesOrderCupomPreviewProps) {
  return (
    <HtmlPrintPreview
      src={salesOrderCupomPreviewUrl(orderId)}
      title='Pré-visualização do cupom'
      errorMessage='Não foi possível carregar o cupom.'
      autoPrint={autoPrint}
      className={className}
      onPrintReady={onPrintReady}
    />
  )
}

type PrintRequest =
  | { kind: 'cupom', orderId: string, autoPrint?: boolean }
  | { kind: 'nfce', documentId: string, autoPrint?: boolean }

type PrintListener = (request: PrintRequest | null) => void

let printListener: PrintListener | null = null

export function openSalesOrderCupomPrint (
  orderId: string,
  opts?: { autoPrint?: boolean }
) {
  printListener?.({
    kind: 'cupom',
    orderId,
    autoPrint: opts?.autoPrint !== false,
  })
}

export function openNfceDanfePrint (
  documentId: string,
  opts?: { autoPrint?: boolean }
) {
  printListener?.({
    kind: 'nfce',
    documentId,
    autoPrint: opts?.autoPrint !== false,
  })
}

export function salesOrderCupomPrintLabel (_status?: string | null) {
  return 'Imprimir cupom'
}

/** Host global: montar uma vez no PortalShell para abrir o modal de qualquer tela. */
export function SalesOrderCupomPrintHost () {
  const [request, setRequest] = useState<PrintRequest | null>(null)
  const printRef = useRef<(() => boolean) | null>(null)
  const [busyPrint, setBusyPrint] = useState(false)
  const isNfce = request?.kind === 'nfce'

  useEffect(() => {
    printListener = setRequest
    return () => {
      if (printListener === setRequest) printListener = null
    }
  }, [])

  function handleClose () {
    setRequest(null)
  }

  function handlePrint () {
    setBusyPrint(true)
    try {
      printRef.current?.()
    } finally {
      window.setTimeout(() => setBusyPrint(false), 400)
    }
  }

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
    >
      <DialogContent aria-describedby={undefined} className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isNfce ? 'NFC-e' : 'Cupom do pedido'}</DialogTitle>
          <DialogDescription>
            Pré-visualização. A impressão usa o diálogo do sistema, sem abrir outra página.
          </DialogDescription>
        </DialogHeader>

        {request?.kind === 'cupom' ? (
          <HtmlPrintPreview
            src={salesOrderCupomPreviewUrl(request.orderId)}
            title='Pré-visualização do cupom'
            errorMessage='Não foi possível carregar o cupom.'
            autoPrint={Boolean(request.autoPrint)}
            onPrintReady={(print) => {
              printRef.current = print
            }}
          />
        ) : request?.kind === 'nfce' ? (
          <HtmlPrintPreview
            src={nfceDanfePreviewUrl(request.documentId)}
            title='Pré-visualização da NFC-e'
            errorMessage='Não foi possível carregar a NFC-e.'
            autoPrint={Boolean(request.autoPrint)}
            onPrintReady={(print) => {
              printRef.current = print
            }}
          />
        ) : null}

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button type='button' variant='secondary' onClick={handleClose}>
            Fechar
          </Button>
          <Button type='button' disabled={busyPrint || !request} onClick={handlePrint}>
            {busyPrint ? <Loader2 className='h-4 w-4 animate-spin' /> : <Printer className='h-4 w-4' />}
            <span className='ml-2'>{isNfce ? 'Imprimir NFC-e' : 'Imprimir cupom'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
