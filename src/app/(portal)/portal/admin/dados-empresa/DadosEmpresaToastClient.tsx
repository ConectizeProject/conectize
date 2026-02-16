'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

export function DadosEmpresaToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('ok') !== '1') return

    toast({
      variant: 'success',
      title: 'Dados salvos',
      description: 'As informações da empresa foram atualizadas.',
    })

    router.replace('/portal/admin/dados-empresa')
  }, [router, searchParams])

  return null
}
