'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from '@/hooks/use-toast'

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: 'Parâmetros ausentes na resposta da integração.',
  invalid_state: 'Sessão inválida. Tente conectar novamente.',
  client_id_missing:
    'Defina o Client ID no servidor (variáveis de ambiente) para iniciar o OAuth.',
  config_missing: 'OAuth não configurado. Configure Client ID e Client Secret.',
  db_error: 'Erro ao salvar a conexão. Tente novamente.',
  token_failed: 'Falha ao obter token. Tente autorizar novamente.',
  forbidden: 'Sem permissão para conectar integrações.',
  bling_forbidden:
    'O Bling retornou FORBIDDEN: a conta que fez login não tem permissão para autorizar ou acessar os recursos pedidos por este aplicativo. No Bling, faça login com um usuário administrador da empresa (ou o perfil que o Bling permite instalar/autorizar apps e API), confira permissões do usuário em Cadastros > Usuários, e tente Conectar de novo. Se a conta tiver várias empresas, confirme que está na empresa correta antes de autorizar.',
  bling_access_denied:
    'Autorização negada no Bling. Tente de novo e aceite as permissões do aplicativo.',
  bling_invalid_request:
    'Requisição OAuth inválida. Revise a configuração do aplicativo no Bling.',
  bling_unauthorized_client:
    'Cliente OAuth não autorizado. Verifique o Client ID no painel do Bling.',
  bling_unsupported_response_type:
    'Tipo de resposta OAuth não suportado pelo Bling.',
  bling_invalid_scope:
    'Escopo inválido. Ajuste os escopos do aplicativo no Bling ou defina BLING_OAUTH_SCOPE se necessário.',
  bling_server_error: 'Erro no servidor do Bling. Tente novamente mais tarde.',
  bling_temporarily_unavailable:
    'Serviço do Bling temporariamente indisponível. Tente novamente em instantes.',
  bling_oauth_unknown: 'Erro OAuth retornado pelo Bling.',
  bling_invalid_grant:
    'Código de autorização inválido ou expirado. Clique em Conectar e autorize de novo.',
  bling_invalid_client:
    'Client ID ou Client Secret incorretos nas variáveis de ambiente.',
  bling_unsupported_grant_type: 'Grant type não suportado na troca de token.',
  bling_token_unknown: 'O Bling recusou a troca do código por token.',
  meli_access_denied:
    'Autorização negada no Mercado Livre. Tente de novo e aceite as permissões do aplicativo.',
  meli_invalid_request:
    'Requisição OAuth inválida. Revise a URL de redirecionamento no painel do Mercado Livre.',
  meli_unauthorized_client:
    'Cliente OAuth não autorizado. Verifique o MELI_CLIENT_ID.',
  meli_unsupported_response_type:
    'Tipo de resposta OAuth não suportado pelo Mercado Livre.',
  meli_invalid_scope:
    'Escopo inválido. Ajuste as permissões do aplicativo no Mercado Livre.',
  meli_server_error:
    'Erro no servidor do Mercado Livre. Tente novamente mais tarde.',
  meli_temporarily_unavailable:
    'Serviço do Mercado Livre temporariamente indisponível. Tente novamente em instantes.',
  meli_oauth_unknown: 'Erro OAuth retornado pelo Mercado Livre.',
  meli_invalid_grant:
    'Código de autorização inválido ou expirado. Clique em Conectar e autorize de novo.',
  meli_invalid_client:
    'Client ID ou Client Secret incorretos nas variáveis de ambiente.',
  meli_unsupported_grant_type: 'Grant type não suportado na troca de token.',
  meli_token_unknown: 'O Mercado Livre recusou a troca do código por token.',
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
    } else if (toastType === 'meli_connected') {
      toast({
        variant: 'success',
        title: 'Mercado Livre conectado',
        description:
          'A integração com o Mercado Livre foi configurada com sucesso.',
      })
    } else if (toastType === 'meli_error') {
      const message = searchParams.get('message')
      const detail = searchParams.get('detail')
      const mapped =
        message === 'client_id_missing'
          ? 'Defina MELI_CLIENT_ID no servidor (variáveis de ambiente) para iniciar o OAuth.'
          : message === 'config_missing'
            ? 'Mercado Livre OAuth não configurado. Configure MELI_CLIENT_ID e MELI_CLIENT_SECRET.'
            : message && ERROR_MESSAGES[message]
              ? ERROR_MESSAGES[message]
              : message || 'Erro ao conectar com o Mercado Livre.'
      const desc = detail ? `${mapped} — ${detail}` : mapped
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar Mercado Livre',
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
