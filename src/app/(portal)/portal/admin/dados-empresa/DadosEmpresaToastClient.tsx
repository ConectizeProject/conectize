'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

export function DadosEmpresaToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ok = searchParams.get('ok')
    const error = searchParams.get('error')

    if (ok === '1') {
      toast({
        variant: 'success',
        title: 'Dados salvos',
        description: 'As informações da empresa foram atualizadas.',
      })
      router.replace('/portal/admin/dados-empresa')
      return
    }

    if (error === 'logo') {
      toast({
        variant: 'destructive',
        title: 'Falha no logo',
        description: 'Não foi possível enviar a imagem. Use JPG, PNG, WebP ou SVG até 2 MB.',
      })
      router.replace('/portal/admin/dados-empresa')
    }
  }, [router, searchParams])

  return null
}
