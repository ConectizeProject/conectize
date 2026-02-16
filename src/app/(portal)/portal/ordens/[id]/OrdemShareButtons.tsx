'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '').trim()
  if (!digits) return ''
  const withCountry = digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits
  return withCountry
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
    lines.push(`Previsão de conclusão: ${new Date(opts.estimatedReadyAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
  }
  lines.push('', `Acesse sua OS (link público): ${opts.orderHref}`)
  return lines.join('\n')
}

type Props = {
  orderId: string
  /** Caminho público /os/[token]. Quando null, é obtido via API. */
  publicOrderPath: string | null
  displayNumber: string | number
  title: string
  customerName: string
  device: string
  status: string
  estimatedReadyAt: string | null
  mobilePhone?: string | null
  email?: string | null
}

export function OrdemShareButtons({
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
}: Props) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null)

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
        .catch(() => {})
      return () => { cancelled = true }
    }
  }, [orderId, publicOrderPath])

  const orderHref = publicUrl ?? ''
  const message = orderHref
    ? buildOrderMessage({
        displayNumber,
        title,
        customerName,
        device,
        status,
        estimatedReadyAt,
        orderHref,
      })
    : ''

  const whatsappNumber = mobilePhone ? formatPhoneForWhatsApp(mobilePhone) : ''
  const whatsappHref = whatsappNumber && message
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : null

  const mailtoHref = email && message
    ? `mailto:${email}?subject=${encodeURIComponent(`Ordem de Serviço #${displayNumber} - Conectize`)}&body=${encodeURIComponent(message)}`
    : null

  const isLoading = !orderHref
  const hasAnyChannel = Boolean(whatsappNumber || email)

  if (!hasAnyChannel) return null

  return (
    <div className="flex items-center gap-2">
      {whatsappHref ? (
        <Button variant="outline" size="sm" asChild disabled={isLoading}>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 mr-2" />
            {isLoading ? 'Carregando…' : 'Enviar WhatsApp'}
          </a>
        </Button>
      ) : null}
      {mailtoHref ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          disabled={isLoading}
        >
          <a href={mailtoHref}>
            <Mail className="h-4 w-4 mr-2" />
            {isLoading ? 'Carregando…' : 'Enviar por email'}
          </a>
        </Button>
      ) : null}
    </div>
  )
}
