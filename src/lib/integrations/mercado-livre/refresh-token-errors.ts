/**
 * Mensagens amigáveis para falhas de token do Mercado Livre
 * (sync de anúncios, cron e respostas de API).
 */

const KNOWN_MESSAGES: Record<string, string> = {
  meli_not_connected: 'Conecte o Mercado Livre no HUB para sincronizar anúncios.',
  meli_user_id_missing_in_connection:
    'A conta do Mercado Livre está incompleta. Desconecte e conecte de novo no HUB.',
  meli_access_token_missing:
    'Não há token de acesso do Mercado Livre. Desconecte e conecte de novo no HUB.',
  no_refresh_token:
    'Não há refresh token salvo. Desconecte e conecte o Mercado Livre novamente no HUB.',
  meli_oauth_not_configured:
    'OAuth do Mercado Livre não configurado no servidor (MELI_CLIENT_ID / MELI_CLIENT_SECRET).',
  refresh_failed_no_access_token:
    'O Mercado Livre não retornou um access token. Tente novamente em instantes.',
  refresh_failed_no_refresh_token:
    'O Mercado Livre não retornou um refresh token. Desconecte e conecte de novo no HUB.',
  db_update_failed:
    'Token renovado no Mercado Livre, mas falhou ao salvar no banco. Tente de novo.',
  invalid_token:
    'O token de acesso do Mercado Livre expirou. Tente de novo; se persistir, desconecte e conecte a conta no HUB.',
  invalid_grant:
    'O token de atualização do Mercado Livre expirou ou foi revogado. Desconecte e conecte a conta de novo no HUB.',
  invalid_client:
    'Client ID ou Client Secret do Mercado Livre incorretos nas variáveis de ambiente.',
}

function looksLikeInvalidGrant (raw: string) {
  const n = raw.toLowerCase()
  return (
    n.includes('invalid_grant')
    || n.includes('invalid_token')
    || n.includes('invalid token')
    || n.includes('invalid refresh token')
  )
}

function looksLikeInvalidClient (raw: string) {
  const n = raw.toLowerCase()
  return n.includes('invalid_client') || n.includes('unauthorized_client')
}

export function meliRefreshTokenErrorToMessage (error: string | null | undefined): string {
  const raw = String(error || '').trim()
  if (!raw) {
    return 'Não foi possível autenticar no Mercado Livre.'
  }

  if (KNOWN_MESSAGES[raw]) {
    return KNOWN_MESSAGES[raw]
  }

  if (looksLikeInvalidGrant(raw)) {
    return KNOWN_MESSAGES.invalid_grant
  }

  if (looksLikeInvalidClient(raw)) {
    return KNOWN_MESSAGES.invalid_client
  }

  if (raw.startsWith('db_update_failed')) {
    return KNOWN_MESSAGES.db_update_failed
  }

  if (raw.startsWith('refresh_failed_http_')) {
    const detail = raw.replace(/^refresh_failed_http_\d+:\s*/i, '').trim()
    if (looksLikeInvalidGrant(detail) || looksLikeInvalidGrant(raw)) {
      return KNOWN_MESSAGES.invalid_grant
    }
    if (looksLikeInvalidClient(detail) || looksLikeInvalidClient(raw)) {
      return KNOWN_MESSAGES.invalid_client
    }
    if (detail && detail !== raw) {
      return `O Mercado Livre recusou a renovação do token: ${detail}`
    }
    return 'O Mercado Livre recusou a renovação do token. Tente novamente ou reconecte a conta no HUB.'
  }

  if (/^[a-z0-9_]+$/i.test(raw) && raw.length < 64) {
    return `Não foi possível sincronizar com o Mercado Livre (${raw}).`
  }

  return raw
}

export function meliSyncFailureMessage (
  data: { error?: unknown, message?: unknown } | null | undefined,
): string {
  const code = String(data?.error ?? '').trim()
  if (code) return meliRefreshTokenErrorToMessage(code)
  return meliRefreshTokenErrorToMessage(String(data?.message ?? '').trim())
}
