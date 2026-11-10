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

export function printHtmlIframe (iframe: HTMLIFrameElement | null) {
  const win = iframe?.contentWindow
  if (!win) return false
  win.focus()
  win.print()
  return true
}

type HtmlPrintPreviewProps = {
  src?: string | null
  /** HTML inline (checkout PDV). Preferir quando o cupom já veio na resposta. */
  html?: string | null
  title: string
  errorMessage: string
  autoPrint?: boolean
  className?: string
  iframeClassName?: string
  /** Ajusta a altura do iframe ao conteúdo, até este limite em px. */
  fitContentMax?: number
  onPrintReady?: (print: () => boolean) => void
}

export function HtmlPrintPreview ({
  src = null,
  html = null,
  title,
  errorMessage,
  autoPrint = false,
  className,
  iframeClassName,
  fitContentMax,
  onPrintReady,
}: HtmlPrintPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const autoPrintedRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const contentKey = html ? `html:${html.length}:${html.slice(0, 32)}` : `src:${src || ''}`

  const doPrint = useCallback(() => printHtmlIframe(iframeRef.current), [])

  useEffect(() => {
    autoPrintedRef.current = false
    setIsLoading(true)
    setHasError(false)
  }, [contentKey])

  useEffect(() => {
    onPrintReady?.(doPrint)
  }, [doPrint, onPrintReady])

  function handleLoad () {
    setIsLoading(false)
    if (fitContentMax && iframeRef.current?.contentDocument?.body) {
      const contentHeight = iframeRef.current.contentDocument.body.scrollHeight
      const next = Math.min(fitContentMax, Math.max(160, contentHeight + 2))
      iframeRef.current.style.height = `${next}px`
    }
    if (!autoPrint || autoPrintedRef.current) return
    autoPrintedRef.current = true
    window.setTimeout(() => {
      doPrint()
    }, 200)
  }

  const hasContent = Boolean(html || src)

  return (
    <div className={className || 'relative overflow-hidden rounded-md border bg-muted/30'}>
      {isLoading && hasContent ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/70'>
          <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        </div>
      ) : null}
      {hasError || !hasContent ? (
        <div className='flex min-h-[280px] items-center justify-center p-4 text-center text-sm text-muted-foreground'>
          {hasContent ? errorMessage : 'Carregando pré-visualização…'}
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          key={contentKey}
          title={title}
          src={html ? undefined : (src || undefined)}
          srcDoc={html || undefined}
          className={iframeClassName || 'h-[min(56vh,420px)] w-full border-0 bg-white'}
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

type HtmlPrintPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string | null
  title: string
  description?: string
  previewTitle: string
  errorMessage: string
  printLabel: string
  autoPrint?: boolean
  iframeClassName?: string
}

export function HtmlPrintPreviewDialog ({
  open,
  onOpenChange,
  src,
  title,
  description = 'Pré-visualização. A impressão usa o diálogo do sistema, sem abrir outra página.',
  previewTitle,
  errorMessage,
  printLabel,
  autoPrint = false,
  iframeClassName,
}: HtmlPrintPreviewDialogProps) {
  const printRef = useRef<(() => boolean) | null>(null)
  const [busyPrint, setBusyPrint] = useState(false)

  function handlePrint () {
    setBusyPrint(true)
    try {
      printRef.current?.()
    } finally {
      window.setTimeout(() => setBusyPrint(false), 400)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {src ? (
          <HtmlPrintPreview
            src={src}
            title={previewTitle}
            errorMessage={errorMessage}
            autoPrint={autoPrint}
            iframeClassName={iframeClassName}
            onPrintReady={(print) => {
              printRef.current = print
            }}
          />
        ) : null}

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button type='button' variant='secondary' onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type='button' disabled={busyPrint || !src} onClick={handlePrint}>
            {busyPrint ? <Loader2 className='h-4 w-4 animate-spin' /> : <Printer className='h-4 w-4' />}
            <span className='ml-2'>{printLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
