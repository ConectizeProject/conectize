'use client'

import {
  Copy,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
  Printer,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { toast } from '@/hooks/use-toast'
import { getPrintWindowFeatures } from '@/lib/ordem-print'
import { appConfirm, appAlert } from '@/lib/ui/app-dialogs'
import { buildQuoteEmailSubject, buildQuoteMessage } from '@/lib/quotes/quote-share-message'
import {
  canConvertQuoteStatus,
  QUOTE_MANUAL_STATUS_VALUES,
  QUOTE_STATUS_LABELS,
} from '@/lib/quotes/quote-status'
import { usePortalOrganizationName } from '@/lib/portal/portal-branding-context'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import { useQuoteWhatsappShare } from './use-quote-whatsapp-share'

export type QuoteActionsCustomer = {
  is_company?: boolean | null
  full_name?: string | null
  company_name?: string | null
  email?: string | null
  mobile_phone?: string | null
}

type Props = {
  quoteId: string
  displayNumber: string | number
  title: string
  status: string
  validUntil: string | null
  totalCents: number
  shareToken?: string | null
  customer: QuoteActionsCustomer | null
  serviceOrderHref?: string | null
}

export function OrcamentoActionsMenu ({
  quoteId,
  displayNumber,
  title,
  status,
  validUntil,
  totalCents,
  shareToken,
  customer,
  serviceOrderHref,
}: Props) {
  const organizationName = usePortalOrganizationName()
  const router = useRouter()
  const { openShare, shareLoading, ShareDialog } = useQuoteWhatsappShare(quoteId)
  const [fetchedPublicUrl, setFetchedPublicUrl] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [converting, setConverting] = useState(false)

  const publicPath = shareToken ? `/orcamento/${shareToken}` : null
  const quoteHref =
    fetchedPublicUrl ??
    (publicPath && typeof window !== 'undefined'
      ? `${window.location.origin}${publicPath}`
      : '')

  useEffect(() => {
    if (publicPath || fetchedPublicUrl) return
    let cancelled = false
    fetch(`/api/portal/orcamentos/${quoteId}/share-link`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.url) setFetchedPublicUrl(data.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [quoteId, publicPath, fetchedPublicUrl])

  const customerName = customer?.is_company
    ? customer?.company_name || customer?.full_name || ''
    : customer?.full_name || ''

  const message = quoteHref
    ? buildQuoteMessage({
      displayNumber,
      title,
      customerName,
      status: QUOTE_STATUS_LABELS[status] || status,
      validUntil,
      totalCents,
      quoteHref,
      organizationName,
    })
    : ''

  const whatsappNumber = customer?.mobile_phone
    ? formatPhoneForWhatsApp(customer.mobile_phone)
    : ''
  const whatsappHref =
    whatsappNumber && message
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
      : null
  const mailtoHref =
    customer?.email && message
      ? `mailto:${customer.email}?subject=${encodeURIComponent(buildQuoteEmailSubject(displayNumber, organizationName))}&body=${encodeURIComponent(message)}`
      : null

  async function handleCopyLink () {
    let url = quoteHref
    if (!url) {
      const res = await fetch(`/api/portal/orcamentos/${quoteId}/share-link`)
      const data = await res.json().catch(() => null)
      url = typeof data?.url === 'string' ? data.url : ''
      if (url) setFetchedPublicUrl(url)
    }
    if (!url) {
      toast({ title: 'Não foi possível gerar o link', variant: 'destructive' })
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast({ variant: 'success', title: 'Link copiado' })
    } catch {
      toast({ title: 'Não foi possível copiar o link', variant: 'destructive' })
    }
  }

  async function handlePrint () {
    const w = window.open(
      `/api/portal/orcamentos/${quoteId}/print`,
      '_blank',
      getPrintWindowFeatures(),
    )
    if (!w) {
      await appAlert({
        title: 'Pop-up bloqueado',
        description: 'Permita pop-ups para imprimir o orçamento.',
      })
    }
  }

  async function handleStatus (next: string) {
    if (next === status) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/portal/orcamentos/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Não foi possível alterar o status', variant: 'destructive' })
        return
      }
      toast({ variant: 'success', title: 'Status atualizado' })
      router.refresh()
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConvert () {
    if (!canConvertQuoteStatus(status)) return
    const ok = await appConfirm({
      title: 'Criar OS a partir deste orçamento?',
      description: 'A ordem será criada com o cliente e os itens já preenchidos. O aparelho fica para completar na OS.',
      confirmLabel: 'Criar OS',
    })
    if (!ok) return
    setConverting(true)
    try {
      const res = await fetch(`/api/portal/orcamentos/${quoteId}/convert-to-os`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || typeof data.redirectTo !== 'string') {
        toast({
          title: 'Não foi possível criar a OS',
          description: String(data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      router.push(data.redirectTo)
    } finally {
      setConverting(false)
    }
  }

  async function handleDelete () {
    const ok = await appConfirm({
      title: 'Excluir orçamento?',
      description: status === 'convertido'
        ? 'A OS já criada não será excluída. Esta ação não pode ser desfeita.'
        : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    const res = await fetch(`/api/portal/orcamentos/${quoteId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao excluir orçamento', variant: 'destructive' })
      return
    }
    toast({ variant: 'success', title: 'Orçamento excluído' })
    router.push('/portal/orcamentos')
    router.refresh()
  }

  return (
    <>
      {ShareDialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="Ações do orçamento">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => { void handleCopyLink() }}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar link público
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={shareLoading}
            onClick={() => { void openShare(message, whatsappHref) }}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar WhatsApp
          </DropdownMenuItem>
          {mailtoHref ? (
            <DropdownMenuItem asChild>
              <a href={mailtoHref}>
                <Mail className="mr-2 h-4 w-4" />
                Enviar e-mail
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => { void handlePrint() }}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status !== 'convertido' ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={statusUpdating}>
                Alterar status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {QUOTE_MANUAL_STATUS_VALUES.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    disabled={s === status}
                    onClick={() => { void handleStatus(s) }}
                  >
                    {QUOTE_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {canConvertQuoteStatus(status) ? (
            <DropdownMenuItem
              disabled={converting}
              onClick={() => { void handleConvert() }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Criar OS
            </DropdownMenuItem>
          ) : null}
          {serviceOrderHref ? (
            <DropdownMenuItem asChild>
              <Link href={serviceOrderHref}>Abrir OS gerada</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => { void handleDelete() }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
