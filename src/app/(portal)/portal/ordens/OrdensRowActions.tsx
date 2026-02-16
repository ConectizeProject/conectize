'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { Button } from '@/components/ui/button'
import { Printer, MessageCircle, Mail, MoreHorizontal, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
  finalizada: 'Finalizada',
  finalizada_sem_conserto: 'Finalizada sem conserto',
  finalizada_sem_aprovacao: 'Finalizada sem aprovação',
  cancelada: 'Cancelada',
}

function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '').trim()
  if (!digits) return ''
  return digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits
}

function buildOrderMessage(opts: {
  displayNumber: string | number
  title: string
  customerName: string
  device: string
  status: string
  estimatedReadyAt: string | null
  orderHref: string
}) {
  const lines = [
    `Olá${opts.customerName ? ` ${opts.customerName}` : ''}!`,
    '',
    `*Ordem de Serviço #${opts.displayNumber}* - Conectize`,
    `Título: ${opts.title}`,
    `Status: ${opts.status}`,
    `Dispositivo: ${opts.device || '-'}`,
  ]
  if (opts.estimatedReadyAt) {
    lines.push(`Previsão: ${new Date(opts.estimatedReadyAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
  }
  lines.push('', `Acesse sua OS (link público): ${opts.orderHref}`)
  return lines.join('\n')
}

type OrderRow = {
  id: string
  display_number: number | null
  status: string
  title: string
  created_at: string
  updated_at: string
  estimated_ready_at: string | null
  share_token?: string | null
  customers: {
    cpf?: string | null
    cnpj?: string | null
    is_company?: boolean
    full_name?: string | null
    company_name?: string | null
    email?: string | null
    mobile_phone?: string | null
  } | null
  device_models: { brand?: string; device_type?: string; model?: string } | null
}

type Props = {
  order: OrderRow
}

export function OrdensRowActions({ order }: Props) {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [fetchedPublicUrl, setFetchedPublicUrl] = useState<string | null>(null)

  const customer = order.customers
  const deviceModel = order.device_models
  const displayNumber = order.display_number ?? order.id
  const customerName = customer?.is_company ? (customer?.company_name || customer?.full_name || '') : (customer?.full_name || '')
  const device = deviceModel ? `${deviceModel.brand || ''} ${deviceModel.device_type || ''} ${deviceModel.model || ''}`.trim() || '-' : '-'
  const statusLabel = STATUS_LABELS[order.status] || order.status

  const publicPath = order.share_token ? `/os/${order.share_token}` : null
  const orderHref =
    fetchedPublicUrl ??
    (publicPath && typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : '')

  useEffect(() => {
    if (publicPath || fetchedPublicUrl) return
    let cancelled = false
    fetch(`/api/portal/ordens/${order.id}/share-link`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.url) setFetchedPublicUrl(data.url)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [order.id, publicPath, fetchedPublicUrl])
  const message = orderHref ? buildOrderMessage({
    displayNumber,
    title: order.title,
    customerName,
    device,
    status: statusLabel,
    estimatedReadyAt: order.estimated_ready_at,
    orderHref,
  }) : ''

  const whatsappNumber = customer?.mobile_phone ? formatPhoneForWhatsApp(customer.mobile_phone) : ''
  const whatsappHref = whatsappNumber && message ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : null
  const mailtoHref = customer?.email && message
    ? `mailto:${customer.email}?subject=${encodeURIComponent(`Ordem de Serviço #${displayNumber} - Conectize`)}&body=${encodeURIComponent(message)}`
    : null

  async function handleStatusChange(newStatus: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/portal/ordens/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
        return
      }
      toast({ variant: 'success', title: 'Status atualizado', description: `${STATUS_LABELS[newStatus] || newStatus}` })
      router.refresh()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onClick={() => window.open(`/api/portal/ordens/${order.id}/print`, '_blank', 'width=800,height=600')}
        >
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </DropdownMenuItem>
        {whatsappHref ? (
          <DropdownMenuItem asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </a>
          </DropdownMenuItem>
        ) : null}
        {mailtoHref ? (
          <DropdownMenuItem asChild>
            <a href={mailtoHref}>
              <Mail className="h-4 w-4 mr-2" />
              Enviar por email
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={updating}>
            Alterar status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => handleStatusChange(value)}
                disabled={updating || order.status === value}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem asChild>
          <Link href={`/portal/ordens/${order.id}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir ordem
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
