'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { getOrdemErrorMessage } from '@/lib/utils/error-messages'

export function OrdemDetalheToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const errorCode = searchParams.get('error')
    const ok = searchParams.get('ok')
    const toastType = searchParams.get('toast')

    const params = new URLSearchParams(searchParams.toString())
    let shouldReplace = false

    if (errorCode) {
      const saveEc = searchParams.get('ec')
      const saveEm = searchParams.get('em')
      toast({
        variant: 'destructive',
        title: 'Não foi possível concluir',
        description: getOrdemErrorMessage(errorCode, undefined, {
          saveDbCode: saveEc,
          saveDbMessage: saveEm,
        }),
      })
      params.delete('error')
      params.delete('ec')
      params.delete('em')
      shouldReplace = true
    } else if (ok === '1') {
      toast({
        variant: 'success',
        title: 'Dados salvos',
        description: 'As alterações da ordem de serviço foram salvas com sucesso.',
      })
      params.delete('ok')
      shouldReplace = true
    } else if (toastType === 'order_created') {
      toast({
        variant: 'success',
        title: 'Ordem criada',
        description: 'Ordem de serviço criada com sucesso.',
      })
      params.delete('toast')
      shouldReplace = true
    }

    if (!shouldReplace) return

    const qs = params.toString()
    const pathname = window.location.pathname
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams])

  return null
}
