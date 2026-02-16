'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

function cleanParams(params: URLSearchParams) {
  params.delete('toast')
  params.delete('id')
  params.delete('error')
  return params
}

export function OrdensToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const toastType = searchParams.get('toast')
    if (!toastType) return

    const orderId = String(searchParams.get('id') || '').trim()
    const error = String(searchParams.get('error') || '').trim()

    if (toastType === 'order_created') {
      toast({
        variant: 'success',
        title: 'Ordem criada',
        description: 'Ordem de serviço criada com sucesso.',
        action: orderId ? (
          <ToastAction altText="Abrir ordem" onClick={() => router.push(`/portal/ordens/${orderId}`)}>
            Abrir
          </ToastAction>
        ) : undefined,
      })
    } else if (toastType === 'order_error') {
      toast({
        title: 'Não foi possível criar',
        description: error || 'Tente novamente.',
        variant: 'destructive',
      })
    }

    const next = cleanParams(new URLSearchParams(searchParams.toString()))
    const qs = next.toString()
    router.replace(qs ? `/portal/ordens?${qs}` : '/portal/ordens')
  }, [router, searchParams])

  return null
}

