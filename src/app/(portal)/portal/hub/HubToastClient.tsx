'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: 'Parâmetros ausentes na resposta do Bling.',
  invalid_state: 'Sessão inválida. Tente conectar novamente.',
  client_id_missing: 'Defina BLING_CLIENT_ID no servidor (variáveis de ambiente) para iniciar o OAuth.',
  config_missing: 'Bling OAuth não configurado. Configure BLING_CLIENT_ID e BLING_CLIENT_SECRET.',
  db_error: 'Erro ao salvar a conexão. Tente novamente.',
  token_failed: 'Falha ao obter token. Tente autorizar novamente.',
  forbidden: 'Sem permissão para conectar integrações.',
  bling_forbidden:
    'O Bling retornou FORBIDDEN: a conta que fez login não tem permissão para autorizar ou acessar os recursos pedidos por este aplicativo. No Bling, faça login com um usuário administrador da empresa (ou o perfil que o Bling permite instalar/autorizar apps e API), confira permissões do usuário em Cadastros > Usuários, e tente Conectar de novo. Se a conta tiver várias empresas, confirme que está na empresa correta antes de autorizar.',
  bling_access_denied: 'Autorização negada no Bling. Tente de novo e aceite as permissões do aplicativo.',
  bling_invalid_request: 'Requisição OAuth inválida. Revise a configuração do aplicativo no Bling.',
  bling_unauthorized_client: 'Cliente OAuth não autorizado. Verifique o Client ID no painel do Bling.',
  bling_unsupported_response_type: 'Tipo de resposta OAuth não suportado pelo Bling.',
  bling_invalid_scope: 'Escopo inválido. Ajuste os escopos do aplicativo no Bling ou defina BLING_OAUTH_SCOPE se necessário.',
  bling_server_error: 'Erro no servidor do Bling. Tente novamente mais tarde.',
  bling_temporarily_unavailable: 'Serviço do Bling temporariamente indisponível. Tente novamente em instantes.',
  bling_oauth_unknown: 'Erro OAuth retornado pelo Bling.',
  bling_invalid_grant: 'Código de autorização inválido ou expirado. Clique em Conectar e autorize de novo.',
  bling_invalid_client: 'Client ID ou Client Secret incorretos nas variáveis de ambiente.',
  bling_unsupported_grant_type: 'Grant type não suportado na troca de token.',
  bling_token_unknown: 'O Bling recusou a troca do código por token.',
}

export function HubToastClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const toastType = searchParams.get('toast')

    if (toastType === 'bling_connected') {
      toast({
        variant: 'success',
        title: 'Bling conectado',
        description: 'A integração com o Bling foi configurada com sucesso.',
      })
    } else if (toastType === 'bling_error') {
      const message = searchParams.get('message')
      const detail = searchParams.get('detail')
      const base =
        message && ERROR_MESSAGES[message]
          ? ERROR_MESSAGES[message]
          : message || 'Erro ao conectar com o Bling.'
      const desc = detail ? `${base} — ${detail}` : base
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
    params.delete('detail')
    const qs = params.toString()
    const pathname = window.location.pathname
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams])

  return null
}
