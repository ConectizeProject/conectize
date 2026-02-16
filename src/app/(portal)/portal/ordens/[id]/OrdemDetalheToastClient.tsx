'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

export function OrdemDetalheToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ok = searchParams.get('ok')
    const toastType = searchParams.get('toast')

    if (ok === '1') {
      toast({
        variant: 'success',
        title: 'Dados salvos',
        description: 'As alterações da ordem de serviço foram salvas com sucesso.',
      })
    } else if (toastType === 'order_created') {
      toast({
        variant: 'success',
        title: 'Ordem criada',
        description: 'Ordem de serviço criada com sucesso.',
      })
    } else {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('ok')
    params.delete('toast')
    const qs = params.toString()
    const pathname = window.location.pathname
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams])

  return null
}
