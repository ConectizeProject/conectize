'use client'

import { useEffect, useRef, useState } from 'react'
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
import {
  HtmlPrintPreview,
} from '@/components/print/html-print-preview'
import { appAlert } from '@/lib/ui/app-dialogs'
import { cn } from '@/lib/utils'

export function salesOrderCupomPreviewUrl (orderId: string) {
  return `/api/portal/sales-orders/${encodeURIComponent(orderId)}/print?preview=1`
}

export function nfceDanfePreviewUrl (documentId: string) {
  return `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/danfe?preview=1`
}

export function nfeDanfePreviewUrl (documentId: string) {
  return `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/danfe?preview=1`
}

export function nfeDanfeDownloadUrl (documentId: string) {
  return `/api/portal/fiscal/documents/${encodeURIComponent(documentId)}/danfe?download=1`
}

function printSameOriginPdf (url: string, autoPrint: boolean) {
  const win = window.open(url, 'nfe-danfe-print')
  if (!win) return false
  if (!autoPrint) return true
  const tryPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      // O visualizador de PDF do navegador pode ignorar print() até o arquivo carregar.
    }
  }
  win.addEventListener('load', tryPrint)
  window.setTimeout(tryPrint, 900)
  return true
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
  | { kind: 'nfe', documentId: string, autoPrint?: boolean }

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

export function openNfeDanfePrint (
  documentId: string,
  opts?: { autoPrint?: boolean }
) {
  const url = nfeDanfePreviewUrl(documentId)
  const autoPrint = opts?.autoPrint !== false
  if (printSameOriginPdf(url, autoPrint)) return
  printListener?.({
    kind: 'nfe',
    documentId,
    autoPrint: false,
  })
  void appAlert({
    title: 'Pop-up bloqueado',
    description: 'Permita pop-ups para imprimir a NF-e, ou use Baixar PDF.',
  })
}

export function openFiscalDanfePrint (
  documentId: string,
  model: '55' | '65',
  opts?: { autoPrint?: boolean }
) {
  if (model === '55') openNfeDanfePrint(documentId, opts)
  else openNfceDanfePrint(documentId, opts)
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
  const isNfe = request?.kind === 'nfe'

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
      if (request?.kind === 'nfe') {
        printSameOriginPdf(nfeDanfePreviewUrl(request.documentId), true)
        return
      }
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
      <DialogContent
        aria-describedby={undefined}
        className={cn(isNfe ? 'flex max-h-[92vh] flex-col sm:max-w-4xl' : 'sm:max-w-md')}
      >
        <DialogHeader>
          <DialogTitle>
            {isNfe ? 'DANFE NF-e' : isNfce ? 'NFC-e' : 'Cupom do pedido'}
          </DialogTitle>
          <DialogDescription>
            {isNfe
              ? 'Pré-visualização da NF-e. A impressão usa o diálogo do sistema, em A4.'
              : 'Pré-visualização. A impressão usa o diálogo do sistema, sem abrir outra página.'}
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
        ) : request?.kind === 'nfe' ? (
          <HtmlPrintPreview
            src={nfeDanfePreviewUrl(request.documentId)}
            title='Pré-visualização da NF-e'
            errorMessage='Não foi possível carregar a NF-e.'
            autoPrint={Boolean(request.autoPrint)}
            iframeClassName='h-[min(72vh,780px)] w-full border-0 bg-white'
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
            <span className='ml-2'>
              {isNfe ? 'Imprimir NF-e' : isNfce ? 'Imprimir NFC-e' : 'Imprimir cupom'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
