/**
 * Mapeamento de erros para mensagens amigáveis ao usuário
 */

/** Códigos de erro de autenticação -> mensagem em português */
export const AUTH_ERROR_CODES: Record<string, string> = {
  over_email_send_rate_limit:
    'Por segurança, há um limite de envio de e-mails. Aguarde alguns segundos antes de solicitar novamente.',
}

/** Mensagem quando o Supabase/rede não responde (DNS, timeout, offline). */
export const AUTH_NETWORK_UNAVAILABLE_MESSAGE =
  'Servidor de autenticação indisponível ou sem conexão com a internet. Verifique sua rede e tente novamente em instantes.'

const AUTH_NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network request failed',
  'load failed',
  'connect timeout',
  'connect_timeouterror',
  'eai_again',
  'enotfound',
  'econnrefused',
  'econnreset',
  'etimedout',
  'und_err_connect_timeout',
  'und_err_socket',
  'getaddrinfo',
]

function collectAuthErrorText (error: unknown, maxDepth = 4): string {
  const parts: string[] = []
  let current: unknown = error
  let depth = 0

  while (current != null && depth < maxDepth) {
    if (typeof current === 'string') {
      parts.push(current)
      break
    }
    if (current instanceof Error) {
      parts.push(current.message)
      const code = (current as Error & { code?: string }).code
      if (code) parts.push(String(code))
      current = current.cause
    } else if (typeof current === 'object') {
      const obj = current as { message?: string; code?: string; cause?: unknown }
      if (obj.message) parts.push(String(obj.message))
      if (obj.code) parts.push(String(obj.code))
      current = obj.cause
    } else {
      break
    }
    depth++
  }

  return parts.join(' ').toLowerCase()
}

/** Indica falha de rede/DNS/timeout ao falar com o Supabase (não é credencial inválida). */
export function isAuthNetworkError (error: unknown): boolean {
  const blob = collectAuthErrorText(error)
  return AUTH_NETWORK_ERROR_PATTERNS.some((pattern) => blob.includes(pattern))
}

/** Padrões de erro de autenticação (substring na mensagem) -> mensagem em português */
export const AUTH_ERROR_PATTERNS: Array<[string, string]> = [
  ['invalid login credentials', 'E-mail ou senha inválidos.'],
  ['email not confirmed', 'Seu e-mail ainda não foi confirmado.'],
  ['invalid email', 'E-mail inválido.'],
  ['password should be at least', 'Sua senha não atende aos requisitos mínimos.'],
  ['same password', 'A nova senha precisa ser diferente da senha atual.'],
  ['user already registered', 'Este e-mail já está cadastrado.'],
  ['user not found', 'Usuário não encontrado.'],
  ['too many requests', 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
  ['email rate limit exceeded', 'Você já solicitou muitos e-mails. Tente novamente mais tarde.'],
  ['you can only request this after', 'Por segurança, há um limite de envio de e-mails. Aguarde alguns segundos antes de solicitar novamente.'],
]

/** Códigos de erro de ordem de serviço (criação/edição) -> mensagem em português */
export const ORDEM_ERROR_MESSAGES: Record<string, string> = {
  cpf_invalido: 'CPF inválido.',
  cnpj_invalido: 'CNPJ inválido.',
  title_obrigatorio: 'Título é obrigatório.',
  titulo_obrigatorio: 'Título é obrigatório.',
  customer_obrigatorio: 'Selecione um cliente (CPF/CNPJ).',
  status_invalido: 'Status inválido.',
  dados_invalidos: 'Dados inválidos.',
  nao_foi_possivel_criar_cliente: 'Não foi possível criar o cliente.',
  nao_foi_possivel_criar_os: 'Não foi possível criar a ordem de serviço.',
  nao_foi_possivel_salvar: 'Não foi possível salvar agora.',
  nao_foi_possivel_excluir: 'Não foi possível excluir agora.',
  sem_permissao: 'Você não tem permissão para excluir ordens.',
  ordem_finalizada: 'Ordem finalizada não pode ser alterada.',
  ordem_nao_encontrada: 'A ordem não foi encontrada ao salvar. Recarregue a página e tente de novo.',
  previsao_invalida: 'A previsão deve ser igual ou posterior à data de abertura.',
}

/** Códigos PostgreSQL / PostgREST comuns ao salvar OS → mensagem em português */
const ORDEM_SAVE_DB_CODES: Record<string, string> = {
  '23505': 'Conflito no banco: registro duplicado ou valor único já existente.',
  '23503': 'Referência inválida: algum vínculo (ex.: modelo ou cliente) não foi encontrado.',
  '23514': 'Algum valor não atende às regras do cadastro (validação no banco).',
  '22P02': 'Formato de dado inválido enviado ao banco.',
  '42501': 'Sem permissão para salvar (política de segurança / RLS).',
  'PGRST116': 'A ordem não foi encontrada ou você não tem permissão para vê-la.',
  'PGRST204': 'Nenhuma linha foi atualizada. Recarregue a página e tente de novo.',
}

const MAX_SAVE_DETAIL_LEN = 320

/**
 * Sanitiza trecho de mensagem técnica para exibir na URL / toast (sem quebras de linha excessivas).
 */
function sanitizeSaveDetailMessage (raw: string): string {
  const s = raw
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SAVE_DETAIL_LEN)
  return s || ''
}

type OrderPersistMode = 'save' | 'create'

/**
 * Monta descrição amigável para falha ao salvar/criar OS (código DB + mensagem opcional).
 */
export function getOrderSaveErrorDescription (
  dbCode?: string | null,
  dbMessage?: string | null,
  mode: OrderPersistMode = 'save',
): string {
  const generic =
    mode === 'create'
      ? ORDEM_ERROR_MESSAGES.nao_foi_possivel_criar_os
      : ORDEM_ERROR_MESSAGES.nao_foi_possivel_salvar
  const code = String(dbCode || '').trim()
  const mapped = code ? ORDEM_SAVE_DB_CODES[code] : null
  const detail = sanitizeSaveDetailMessage(String(dbMessage || ''))

  if (mapped && detail) {
    return `${mapped} Detalhe: ${detail}`
  }
  if (mapped) return mapped
  if (detail) {
    return mode === 'create'
      ? `Não foi possível criar a ordem. Detalhe: ${detail}`
      : `Não foi possível salvar. Detalhe: ${detail}`
  }
  return generic
}

/**
 * Converte um erro de autenticação em mensagem amigável
 * @param error - Erro do Supabase ou similar
 * @param fallback - Mensagem padrão quando nenhum padrão corresponder
 */
export function getAuthErrorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.'
): string {
  if (isAuthNetworkError(error)) return AUTH_NETWORK_UNAVAILABLE_MESSAGE

  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '')
    const msg = AUTH_ERROR_CODES[code]
    if (msg) return msg
  }
  const message = collectAuthErrorText(error)
  const normalized = message.toLowerCase()

  for (const [pattern, msg] of AUTH_ERROR_PATTERNS) {
    if (normalized.includes(pattern)) return msg
  }
  return fallback
}

/**
 * Converte um código de erro de ordem de serviço em mensagem amigável
 * @param errorCode - Código retornado (ex: 'title_obrigatorio', 'nao_foi_possivel_salvar')
 * @param fallback - Mensagem padrão quando o código não for conhecido
 */
export function getOrdemErrorMessage(
  errorCode?: string | null,
  fallback = 'Não foi possível concluir. Tente novamente.',
  options?: { saveDbCode?: string | null; saveDbMessage?: string | null }
): string {
  if (!errorCode) return fallback
  if (
    errorCode === 'nao_foi_possivel_salvar'
    && (options?.saveDbCode || options?.saveDbMessage)
  ) {
    return getOrderSaveErrorDescription(options.saveDbCode, options.saveDbMessage, 'save')
  }
  if (
    errorCode === 'nao_foi_possivel_criar_os'
    && (options?.saveDbCode || options?.saveDbMessage)
  ) {
    return getOrderSaveErrorDescription(options.saveDbCode, options.saveDbMessage, 'create')
  }
  return ORDEM_ERROR_MESSAGES[errorCode] ?? fallback
}
