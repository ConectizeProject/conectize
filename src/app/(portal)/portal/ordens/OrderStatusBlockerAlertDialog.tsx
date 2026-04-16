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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {exit && warranty
              ? 'Antes de finalizar'
              : warranty
                ? 'Sem termos de garantia'
                : 'Considerações da assistência não preenchidas'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {exit ? (
                <p>
                  Esta OS não tem checklist nem fotos de saída. Abra a ordem para
                  registrar ou confirme se deseja finalizar assim mesmo.
                </p>
              ) : null}
              {warranty ? (
                <p>
                  Não há modelo nem texto de garantia nesta ordem. Na impressão e no
                  link público não será exibido termo de garantia para o cliente.
                  Deseja finalizar assim mesmo?
                </p>
              ) : null}
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
            disabled={updating || !blocker}
          >
            {updating ? 'Salvando…' : 'Sim, finalizar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
