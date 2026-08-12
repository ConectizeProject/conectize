'use client'

import { useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  registerAppDialogHandler,
  type AppDialogRequest,
} from '@/lib/ui/app-dialogs'

export function AppDialogProvider ({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<AppDialogRequest | null>(null)
  const [promptValue, setPromptValue] = useState('')

  useEffect(() => {
    return registerAppDialogHandler((next) => {
      if (next.type === 'prompt') {
        setPromptValue(next.options.defaultValue || '')
      } else {
        setPromptValue('')
      }
      setRequest(next)
    })
  }, [])

  function closeWithConfirm (value: boolean) {
    if (!request || request.type !== 'confirm') return
    const resolve = request.resolve
    setRequest(null)
    resolve(value)
  }

  function closeWithPrompt (value: string | null) {
    if (!request || request.type !== 'prompt') return
    const resolve = request.resolve
    setRequest(null)
    setPromptValue('')
    resolve(value)
  }

  function closeAlert () {
    if (!request || request.type !== 'alert') return
    const resolve = request.resolve
    setRequest(null)
    resolve()
  }

  const confirmOpen = request?.type === 'confirm'
  const promptOpen = request?.type === 'prompt'
  const alertOpen = request?.type === 'alert'

  return (
    <>
      {children}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && request?.type === 'confirm') closeWithConfirm(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.type === 'confirm' ? request.options.title : ''}</AlertDialogTitle>
            {request?.type === 'confirm' && request.options.description ? (
              <AlertDialogDescription className='whitespace-pre-line'>
                {request.options.description}
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription className='sr-only'>Confirmação</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {request?.type === 'confirm' ? (request.options.cancelLabel || 'Voltar') : 'Voltar'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={request?.type === 'confirm' && request.options.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined}
              onClick={(event) => {
                event.preventDefault()
                closeWithConfirm(true)
              }}
            >
              {request?.type === 'confirm' ? (request.options.confirmLabel || 'Confirmar') : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={promptOpen}
        onOpenChange={(open) => {
          if (!open && request?.type === 'prompt') closeWithPrompt(null)
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{request?.type === 'prompt' ? request.options.title : ''}</DialogTitle>
            {request?.type === 'prompt' && request.options.description ? (
              <DialogDescription className='whitespace-pre-line'>
                {request.options.description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='app-dialog-prompt'>
              {request?.type === 'prompt' ? (request.options.label || 'Valor') : 'Valor'}
            </Label>
            <Textarea
              id='app-dialog-prompt'
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              placeholder={request?.type === 'prompt' ? request.options.placeholder : undefined}
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => closeWithPrompt(null)}>
              {request?.type === 'prompt' ? (request.options.cancelLabel || 'Voltar') : 'Voltar'}
            </Button>
            <Button
              type='button'
              variant={request?.type === 'prompt' && request.options.destructive ? 'destructive' : 'default'}
              disabled={Boolean(
                request?.type === 'prompt'
                && request.options.required
                && !promptValue.trim(),
              )}
              onClick={() => {
                if (request?.type !== 'prompt') return
                const trimmed = promptValue.trim()
                if (request.options.required && !trimmed) return
                closeWithPrompt(trimmed)
              }}
            >
              {request?.type === 'prompt' ? (request.options.confirmLabel || 'Confirmar') : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={alertOpen}
        onOpenChange={(open) => {
          if (!open && request?.type === 'alert') closeAlert()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.type === 'alert' ? request.options.title : ''}</AlertDialogTitle>
            {request?.type === 'alert' && request.options.description ? (
              <AlertDialogDescription className='whitespace-pre-line'>
                {request.options.description}
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription className='sr-only'>Aviso</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                closeAlert()
              }}
            >
              {request?.type === 'alert' ? (request.options.confirmLabel || 'OK') : 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
