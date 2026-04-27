'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Button } from '@/components/ui/button'
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { History, MessageCircle, Mail, MoreVertical, Trash2, Copy, Printer } from 'lucide-react'
import { OrderEditHistoryDialog } from './OrderEditHistoryDialog'
import { toast } from '@/hooks/use-toast'
import { buildOrderEmailSubject, buildOrderMessage } from '@/lib/ordem-share-message'
import { usePortalOrganizationName } from '@/lib/portal/portal-branding-context'
import { ORDER_STATUS_LABELS } from '@/lib/orders/order-status'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import {
  isExitConsiderationsEmpty,
  shouldRequireExitConsiderationsOnStatusChange,
} from '@/lib/orders/exit-considerations'
import { isOrderWarrantyTermsUnset } from '@/lib/orders/order-warranty-terms'
import { updateOrderStatusAction } from './order-detail-actions'

type Props = {
  orderId: string
  publicOrderPath: string | null
  displayNumber: string | number
  title: string
  customerName: string
  device: string
  status: string
  estimatedReadyAt: string | null
  mobilePhone?: string | null
  email?: string | null
  isFinalized: boolean
  canDelete: boolean
  deleteOrderAction: (formData: FormData) => Promise<unknown>
  /** Permite excluir linhas do histórico dentro do diálogo */
  isAdmin?: boolean
  deviceExitChecks: unknown
  exitPhotoCount: number
  warrantyTemplateId: string | null
  warrantyText: string | null
}

export function OrdemActionsMenu({
  orderId,
  publicOrderPath,
  displayNumber,
  title,
  customerName,
  device,
  status,
  estimatedReadyAt,
  mobilePhone,
  email,
  isFinalized: _isFinalized,
  canDelete,
  deleteOrderAction,
  isAdmin = false,
  deviceExitChecks,
  exitPhotoCount,
  warrantyTemplateId,
  warrantyText,
}: Props) {
  const organizationName = usePortalOrganizationName()
  const router = useRouter()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [publicUrl, setPublicUrl] = useState<string | null>(
    publicOrderPath && typeof window !== 'undefined' ? `${window.location.origin}${publicOrderPath}` : null
  )
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [exitConsiderationsOpen, setExitConsiderationsOpen] = useState(false)
  const [pendingFinalizeStatus, setPendingFinalizeStatus] = useState<string | null>(null)
  const [finalizeBlockers, setFinalizeBlockers] = useState<{
    exit: boolean
    warranty: boolean
  } | null>(null)

  useEffect(() => {
    if (publicOrderPath && typeof window !== 'undefined') {
      setPublicUrl(`${window.location.origin}${publicOrderPath}`)
      return
    }
    if (!publicOrderPath && orderId) {
      let cancelled = false
      fetch(`/api/portal/ordens/${orderId}/share-link`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data?.url) setPublicUrl(data.url)
        })
        .catch(() => { })
      return () => { cancelled = true }
    }
  }, [orderId, publicOrderPath])

  const orderHref = publicUrl ?? ''
  const statusLabel = ORDER_STATUS_LABELS[status] ?? status
  const message = orderHref
    ? buildOrderMessage({
      displayNumber,
      title,
      customerName,
      device,
      status: statusLabel,
      estimatedReadyAt,
      orderHref,
      organizationName,
    })
    : ''
  const whatsappNumber = mobilePhone ? formatPhoneForWhatsApp(mobilePhone) : ''
  const whatsappHref = whatsappNumber && message ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : null
  const mailtoHref =
    email && message
      ? `mailto:${email}?subject=${encodeURIComponent(buildOrderEmailSubject(displayNumber, organizationName))}&body=${encodeURIComponent(message)}`
      : null

  async function handleStatusChange(
    newStatus: string,
    options?: {
      confirmIncompleteExit?: boolean
      confirmFinalizeWithoutWarranty?: boolean
    },
  ) {
    const confirmIncompleteExit = options?.confirmIncompleteExit === true
    const confirmFinalizeWithoutWarranty =
      options?.confirmFinalizeWithoutWarranty === true
    if (
      !confirmIncompleteExit &&
      !confirmFinalizeWithoutWarranty &&
      shouldRequireExitConsiderationsOnStatusChange(status, newStatus)
    ) {
      const exitEmpty = isExitConsiderationsEmpty(
        deviceExitChecks,
        exitPhotoCount,
      )
      const warrantyUnset = isOrderWarrantyTermsUnset({
        warranty_template_id: warrantyTemplateId,
        warranty_text: warrantyText,
      })
      if (exitEmpty || warrantyUnset) {
        setPendingFinalizeStatus(newStatus)
        setFinalizeBlockers({ exit: exitEmpty, warranty: warrantyUnset })
        setExitConsiderationsOpen(true)
        return
      }
    }

    setStatusUpdating(true)
    try {
      const fd = new FormData()
      fd.set('orderId', orderId)
      fd.set('status', newStatus)
      if (confirmIncompleteExit) {
        fd.set('confirmIncompleteExit', '1')
      }
      if (confirmFinalizeWithoutWarranty) {
        fd.set('confirmFinalizeWithoutWarranty', '1')
      }
      const result = await updateOrderStatusAction(fd)
      if (result.ok === false) {
        if (result.error === 'exit_considerations_incomplete') {
          setPendingFinalizeStatus(newStatus)
          setFinalizeBlockers({ exit: true, warranty: false })
          setExitConsiderationsOpen(true)
          return
        }
        if (result.error === 'warranty_terms_missing') {
          setPendingFinalizeStatus(newStatus)
          setFinalizeBlockers({ exit: false, warranty: true })
          setExitConsiderationsOpen(true)
          return
        }
        toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
        return
      }
      setExitConsiderationsOpen(false)
      setPendingFinalizeStatus(null)
      setFinalizeBlockers(null)
      toast({
        variant: 'success',
        title: 'Status atualizado',
        description: ORDER_STATUS_LABELS[newStatus] ?? newStatus,
      })
      router.refresh()
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConfirmDelete() {
    setDeleteSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('orderId', orderId)
      await deleteOrderAction(fd)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Mais opções" className="h-9 px-3">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem
            onClick={() => window.open(`/api/portal/ordens/${orderId}/print`, '_blank', getPrintWindowFeatures())}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir OS
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {whatsappHref ? (
            <DropdownMenuItem asChild>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar WhatsApp
              </a>
            </DropdownMenuItem>
          ) : null}
          {message ? (
            <DropdownMenuItem
              onClick={() => {
                navigator?.clipboard?.writeText(message).then(() => {
                  toast({
                    variant: 'success',
                    title: 'Copiado',
                    description: 'Dados copiados para a área de transferência.',
                    duration: 2000,
                  })
                }).catch(() => {
                  toast({
                    variant: 'destructive',
                    title: 'Não foi possível copiar',
                    description: 'Permita o uso da área de transferência ou copie manualmente.',
                  })
                })
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar dados
            </DropdownMenuItem>
          ) : null}
          {mailtoHref ? (
            <DropdownMenuItem asChild>
              <a href={mailtoHref}>
                <Mail className="h-4 w-4 mr-2" />
                Enviar email
              </a>
            </DropdownMenuItem>
          ) : null}
          {(whatsappHref || message || mailtoHref) ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setHistoryOpen(true)
            }}
          >
            <History className="h-4 w-4 mr-2" />
            Histórico de edições
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={statusUpdating}>
              Alterar status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    void handleStatusChange(value)
                  }}
                  disabled={statusUpdating || status === value}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir OS
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <OrderEditHistoryDialog
        orderId={orderId}
        isAdmin={isAdmin}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <AlertDialog
        open={exitConsiderationsOpen}
        onOpenChange={(open) => {
          setExitConsiderationsOpen(open)
          if (!open) {
            setPendingFinalizeStatus(null)
            setFinalizeBlockers(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {finalizeBlockers?.exit && finalizeBlockers?.warranty
                ? 'Antes de finalizar'
                : finalizeBlockers?.warranty
                  ? 'Sem termos de garantia'
                  : 'Considerações da assistência não preenchidas'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {finalizeBlockers?.exit ? (
                  <p>
                    Não há checklist de saída nem fotos de saída registrados nesta OS. Em geral
                    isso ajuda a comparar o aparelho na entrega com o recebimento.
                  </p>
                ) : null}
                {finalizeBlockers?.warranty ? (
                  <p>
                    Não há modelo nem texto de garantia nesta ordem. Na impressão e no link
                    público não será exibido termo de garantia para o cliente. Deseja finalizar
                    assim mesmo?
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusUpdating}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                const next = pendingFinalizeStatus
                const blockers = finalizeBlockers
                if (!next || !blockers) return
                void handleStatusChange(next, {
                  confirmIncompleteExit: blockers.exit,
                  confirmFinalizeWithoutWarranty: blockers.warranty,
                })
              }}
              disabled={statusUpdating || !pendingFinalizeStatus || !finalizeBlockers}
            >
              {statusUpdating ? 'Salvando…' : 'Sim, finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem <strong>#{displayNumber}</strong> — {title} — será excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
