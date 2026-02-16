'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: 'Parâmetros ausentes na resposta do Bling.',
  invalid_state: 'Sessão inválida. Tente conectar novamente.',
  config_missing: 'Bling OAuth não configurado. Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET.',
  db_error: 'Erro ao salvar a conexão. Tente novamente.',
  token_failed: 'Falha ao obter token. Tente autorizar novamente.',
}

export function HubToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const toastType = searchParams.get('toast')
    const message = searchParams.get('message')

    if (toastType === 'bling_connected') {
      toast({
        variant: 'success',
        title: 'Bling conectado',
        description: 'A integração com o Bling foi configurada com sucesso.',
      })
    } else if (toastType === 'bling_error') {
      const desc = message && ERROR_MESSAGES[message] ? ERROR_MESSAGES[message] : message || 'Erro ao conectar com o Bling.'
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar Bling',
        description: desc,
      })
    } else {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('toast')
    params.delete('message')
    const qs = params.toString()
    const pathname = window.location.pathname
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams])

  return null
}
