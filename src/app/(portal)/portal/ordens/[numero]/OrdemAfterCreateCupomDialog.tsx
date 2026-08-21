'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Printer, Receipt } from 'lucide-react'
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
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { appAlert } from '@/lib/ui/app-dialogs'
import { ordemCupomPreviewUrl } from '../OrdemPrintPreview'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  displayNumber: string | number | null
}

export function OrdemAfterCreateCupomDialog ({
  open,
  onOpenChange,
  orderId,
  displayNumber,
}: Props) {
  const printRef = useRef<(() => boolean) | null>(null)
  const [busyPrint, setBusyPrint] = useState(false)

  const previewSrc = ordemCupomPreviewUrl(orderId)
  const osLabel = displayNumber != null ? `#${displayNumber}` : ''

  useEffect(() => {
    if (!open) printRef.current = null
  }, [open, orderId])

  const handlePrint = useCallback(async () => {
    setBusyPrint(true)
    try {
      const printed = printRef.current?.()
      if (printed) return
      const w = window.open(
        `/api/portal/ordens/${encodeURIComponent(orderId)}/cupom`,
        '_blank',
        getPrintWindowFeatures(),
      )
      if (!w) {
        await appAlert({
          title: 'Pop-up bloqueado',
          description: 'Permita pop-ups para imprimir o cupom.',
        })
      }
    } finally {
      window.setTimeout(() => setBusyPrint(false), 400)
    }
  }, [orderId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {osLabel ? `Ordem ${osLabel} criada` : 'Ordem criada'}
          </DialogTitle>
          <DialogDescription>
            Imprima o cupom da OS para o cliente (mesmo formato do PDV).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <HtmlPrintPreview
            src={previewSrc}
            title={`Pré-visualização cupom OS ${osLabel}`}
            errorMessage="Não foi possível carregar a pré-visualização do cupom."
            className="relative flex min-h-[280px] items-start justify-center overflow-hidden rounded-md border bg-muted/40 p-3"
            iframeClassName="h-[360px] w-[80mm] max-w-full border-0 bg-white shadow-sm"
            onPrintReady={(print) => {
              printRef.current = print
            }}
          />

          <Button
            type="button"
            className="w-full"
            disabled={busyPrint}
            onClick={() => void handlePrint()}
          >
            {busyPrint ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            <span className="ml-2">Imprimir cupom</span>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Receipt className="h-4 w-4" />
            <span className="ml-2">Continuar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
