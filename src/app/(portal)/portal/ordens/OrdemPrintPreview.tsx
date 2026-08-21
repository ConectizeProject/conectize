'use client'

import { useEffect, useState } from 'react'
import { HtmlPrintPreviewDialog } from '@/components/print/html-print-preview'

export function ordemCupomPreviewUrl (orderId: string) {
  return `/api/portal/ordens/${encodeURIComponent(orderId)}/cupom?preview=1`
}

export function ordemLabelPreviewUrl (orderId: string) {
  return `/api/portal/ordens/${encodeURIComponent(orderId)}/label?preview=1`
}

type OrdemPrintRequest =
  | { kind: 'cupom', orderId: string, autoPrint?: boolean }
  | { kind: 'label', orderId: string, autoPrint?: boolean }

type PrintListener = (request: OrdemPrintRequest | null) => void

let printListener: PrintListener | null = null

export function openOrdemCupomPrint (
  orderId: string,
  opts?: { autoPrint?: boolean },
) {
  printListener?.({
    kind: 'cupom',
    orderId,
    autoPrint: opts?.autoPrint === true,
  })
}

export function openOrdemLabelPrint (
  orderId: string,
  opts?: { autoPrint?: boolean },
) {
  printListener?.({
    kind: 'label',
    orderId,
    autoPrint: opts?.autoPrint === true,
  })
}

/** Host global: montar uma vez no PortalShell para abrir o modal de qualquer tela de OS. */
export function OrdemPrintPreviewHost () {
  const [request, setRequest] = useState<OrdemPrintRequest | null>(null)
  const isLabel = request?.kind === 'label'

  useEffect(() => {
    printListener = setRequest
    return () => {
      if (printListener === setRequest) printListener = null
    }
  }, [])

  return (
    <HtmlPrintPreviewDialog
      open={Boolean(request)}
      onOpenChange={(next) => {
        if (!next) setRequest(null)
      }}
      src={request
        ? (isLabel
            ? ordemLabelPreviewUrl(request.orderId)
            : ordemCupomPreviewUrl(request.orderId))
        : null}
      title={isLabel ? 'Etiqueta da OS' : 'Cupom da OS'}
      previewTitle={isLabel ? 'Pré-visualização da etiqueta' : 'Pré-visualização do cupom'}
      errorMessage={isLabel
        ? 'Não foi possível carregar a etiqueta.'
        : 'Não foi possível carregar o cupom.'}
      printLabel={isLabel ? 'Imprimir etiqueta' : 'Imprimir cupom'}
      autoPrint={Boolean(request?.autoPrint)}
      iframeClassName={isLabel
        ? 'mx-auto h-[min(56vh,360px)] w-full max-w-[420px] border-0 bg-white'
        : 'h-[min(56vh,420px)] w-full border-0 bg-white'}
    />
  )
}
