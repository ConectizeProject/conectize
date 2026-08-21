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
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { appAlert } from '@/lib/ui/app-dialogs'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  displayNumber: string | number | null
}

function printCupomIframe (iframe: HTMLIFrameElement | null) {
  const win = iframe?.contentWindow
  if (!win) return false
  win.focus()
  win.print()
  return true
}

export function OrdemAfterCreateCupomDialog ({
  open,
  onOpenChange,
  orderId,
  displayNumber,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [busyPrint, setBusyPrint] = useState(false)

  const previewSrc = `/api/portal/ordens/${encodeURIComponent(orderId)}/cupom?preview=1`
  const osLabel = displayNumber != null ? `#${displayNumber}` : ''

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setHasError(false)
  }, [open, orderId])

  const handlePrint = useCallback(async () => {
    setBusyPrint(true)
    try {
      const printed = printCupomIframe(iframeRef.current)
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
          <div className="relative flex min-h-[280px] items-start justify-center overflow-hidden rounded-md border bg-muted/40 p-3">
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            {hasError ? (
              <p className="text-center text-sm text-muted-foreground">
                Não foi possível carregar a pré-visualização do cupom.
              </p>
            ) : (
              <iframe
                ref={iframeRef}
                key={previewSrc}
                title={`Pré-visualização cupom OS ${osLabel}`}
                src={previewSrc}
                className="h-[360px] w-[80mm] max-w-full border-0 bg-white shadow-sm"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
              />
            )}
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={busyPrint || isLoading || hasError}
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
