'use client'

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
import type { OrderStatusBlockerDialogState } from './use-order-status-update'

type Props = {
  open: boolean
  blocker: OrderStatusBlockerDialogState | null
  updating: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function OrderStatusBlockerAlertDialog ({
  open,
  blocker,
  updating,
  onOpenChange,
  onConfirm,
}: Props) {
  const exit = blocker?.exit === true
  const warranty = blocker?.warranty === true
  const pendingCount = (exit ? 1 : 0) + (warranty ? 1 : 0)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Antes de finalizar</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {pendingCount > 1
                  ? 'Há pendências nesta ordem. Confira abaixo e confirme se deseja finalizar assim mesmo.'
                  : 'Há uma pendência nesta ordem. Confira abaixo e confirme se deseja finalizar assim mesmo.'}
              </p>
              <ul className="list-disc space-y-2 pl-5 text-foreground">
                {exit ? (
                  <li>
                    Considerações de saída incompletas (checklist de saída e/ou fotos de
                    saída não registrados).
                  </li>
                ) : null}
                {warranty ? (
                  <li>
                    Termos de garantia não definidos (sem modelo nem texto de garantia na
                    ordem — impressão e link público ficarão sem termo para o cliente).
                  </li>
                ) : null}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={updating}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={updating || !blocker || (!exit && !warranty)}
          >
            {updating ? 'Salvando…' : 'Sim, finalizar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
