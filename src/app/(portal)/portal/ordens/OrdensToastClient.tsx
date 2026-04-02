'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'

function cleanParams(params: URLSearchParams) {
  params.delete('toast')
  params.delete('id')
  params.delete('os')
  params.delete('error')
  return params
}

export function OrdensToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const toastType = searchParams.get('toast')
    const errorParam = String(searchParams.get('error') || '').trim()

    if (!toastType && errorParam) {
      const saveEc = searchParams.get('ec')
      const saveEm = searchParams.get('em')
      toast({
        title: 'Não foi possível concluir',
        description: getOrdemErrorMessage(errorParam, undefined, {
          saveDbCode: saveEc,
          saveDbMessage: saveEm,
        }),
        variant: 'destructive',
      })
      const next = new URLSearchParams(searchParams.toString())
      next.delete('error')
      next.delete('ec')
      next.delete('em')
      const qs = next.toString()
      router.replace(qs ? `/portal/ordens?${qs}` : '/portal/ordens')
      return
    }

    if (!toastType) return

    const orderSeg =
      String(searchParams.get('os') || '').trim() ||
      String(searchParams.get('id') || '').trim()
    const error = errorParam

    if (toastType === 'order_created') {
      toast({
        variant: 'success',
        title: 'Ordem criada',
        description: 'Ordem de serviço criada com sucesso.',
        action: orderSeg ? (
          <ToastAction altText="Abrir ordem" onClick={() => router.push(`/portal/ordens/${orderSeg}`)}>
            Abrir
          </ToastAction>
        ) : undefined,
      })
    } else if (toastType === 'order_error') {
      const saveEc = searchParams.get('ec')
      const saveEm = searchParams.get('em')
      toast({
        title: 'Não foi possível criar',
        description: getOrdemErrorMessage(error, error || 'Tente novamente.', {
          saveDbCode: saveEc,
          saveDbMessage: saveEm,
        }),
        variant: 'destructive',
      })
    }

    const next = cleanParams(new URLSearchParams(searchParams.toString()))
    const qs = next.toString()
    router.replace(qs ? `/portal/ordens?${qs}` : '/portal/ordens')
  }, [router, searchParams])

  return null
}

