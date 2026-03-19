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
import { MessageCircle, Mail, MoreVertical, Trash2, Copy } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { buildOrderMessage } from '@/lib/ordem-share-message'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'

const STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
  finalizada: 'Finalizada',
  finalizada_sem_conserto: 'Finalizada sem conserto',
  finalizada_sem_aprovacao: 'Finalizada sem aprovação',
  cancelada: 'Cancelada',
}

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
  isFinalized,
  canDelete,
  deleteOrderAction,
}: Props) {
  const router = useRouter()
  const [publicUrl, setPublicUrl] = useState<string | null>(
    publicOrderPath && typeof window !== 'undefined' ? `${window.location.origin}${publicOrderPath}` : null
  )
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

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
  const statusLabel = STATUS_LABELS[status] ?? status
  const message = orderHref
    ? buildOrderMessage({
      displayNumber,
      title,
      customerName,
      device,
      status: statusLabel,
      estimatedReadyAt,
      orderHref,
    })
    : ''
  const whatsappNumber = mobilePhone ? formatPhoneForWhatsApp(mobilePhone) : ''
  const whatsappHref = whatsappNumber && message ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : null
  const mailtoHref =
    email && message
      ? `mailto:${email}?subject=${encodeURIComponent(`Ordem de Serviço #${displayNumber} - Conectize`)}&body=${encodeURIComponent(message)}`
      : null

  async function handleStatusChange(newStatus: string) {
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/portal/ordens/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
        return
      }
      toast({
        variant: 'success',
        title: 'Status atualizado',
        description: STATUS_LABELS[newStatus] ?? newStatus,
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Mais opções" className="h-9 px-3">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={statusUpdating}>
              Alterar status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => handleStatusChange(value)}
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
