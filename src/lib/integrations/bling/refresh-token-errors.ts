/**
 * Mensagens amigáveis para falhas ao renovar o access token do Bling
 * (botão no HUB, cron e respostas de API).
 */

const KNOWN_MESSAGES: Record<string, string> = {
  not_authenticated: 'Faça login novamente para renovar o token.',
  forbidden: 'Sem permissão para renovar o token do Bling.',
  connection_id_required: 'Identificador da conexão ausente.',
  bling_connection_not_found: 'Conexão Bling não encontrada.',
  platform_invalid: 'Esta ação só se aplica a conexões do Bling.',
  no_refresh_token:
    'Não há refresh token salvo. Desconecte e conecte o Bling novamente.',
  no_organization_context: 'Organização ativa não encontrada. Selecione uma organização e tente de novo.',
  bling_oauth_not_configured:
    'OAuth do Bling não configurado no servidor (BLING_CLIENT_ID / BLING_CLIENT_SECRET).',
  refresh_failed_no_access_token:
    'O Bling não retornou um access token. Tente novamente em instantes.',
  db_update_failed: 'Token renovado no Bling, mas falhou ao salvar no banco. Tente de novo.',
  invalid_grant:
    'O refresh token expirou ou foi revogado (ex.: após ~30 dias ou nova autorização). Desconecte e conecte o Bling de novo no HUB.',
  invalid_token:
    'O token de acesso do Bling expirou. Tente de novo; se persistir, desconecte e conecte o Bling de novo no HUB.',
  invalid_client:
    'Client ID ou Client Secret incorretos nas variáveis de ambiente.',
  bling_invalid_grant:
    'O refresh token expirou ou foi revogado. Desconecte e conecte o Bling de novo no HUB.',
  bling_invalid_client:
    'Client ID ou Client Secret incorretos nas variáveis de ambiente.',
}

function looksLikeInvalidGrant (raw: string) {
  const n = raw.toLowerCase()
  return (
    n.includes('invalid_grant')
    || n.includes('invalid_token')
    || n.includes('token inválido')
    || n.includes('invalid token')
    || (n.includes('refresh token') && n.includes('revogad'))
  )
}

function looksLikeInvalidClient (raw: string) {
  const n = raw.toLowerCase()
  return n.includes('invalid_client') || n.includes('unauthorized_client')
}

/**
 * Normaliza códigos crus (`refresh_failed_http_401: ...`, `db_update_failed: ...`)
 * para uma mensagem legível em português.
 */
export function blingRefreshTokenErrorToMessage (error: string | null | undefined): string {
  const raw = String(error || '').trim()
  if (!raw) {
    return 'Não foi possível renovar o token.'
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
      return `O Bling recusou a renovação do token: ${detail}`
    }
    return 'O Bling recusou a renovação do token. Tente novamente ou reconecte a conta.'
  }

  // Evita exibir códigos técnicos opacos (snake_case curto) sem contexto.
  if (/^[a-z0-9_]+$/i.test(raw) && raw.length < 64) {
    return `Não foi possível renovar o token (${raw}).`
  }

  return raw
}

/** Código estável para a API (quando o erro bruto traz detalhe do HTTP). */
export function blingRefreshTokenErrorCode (error: string | null | undefined): string {
  const raw = String(error || '').trim()
  if (!raw) return 'refresh_failed'

  if (looksLikeInvalidGrant(raw)) return 'invalid_grant'
  if (looksLikeInvalidClient(raw)) return 'invalid_client'
  if (raw.startsWith('db_update_failed')) return 'db_update_failed'
  if (raw.startsWith('refresh_failed_http_')) return 'refresh_failed'
  if (KNOWN_MESSAGES[raw] || /^[a-z0-9_]+$/i.test(raw)) return raw

  return 'refresh_failed'
}
