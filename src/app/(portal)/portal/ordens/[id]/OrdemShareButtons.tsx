'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildOrderMessage } from '@/lib/ordem-share-message'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'

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
        .catch(() => { })
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
