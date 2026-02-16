/**
 * Mapeamento de erros para mensagens amigáveis ao usuário
 */

/** Padrões de erro de autenticação (substring) -> mensagem em português */
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
]

/** Códigos de erro da busca de OS -> mensagem em português */
export const OS_SEARCH_ERROR_MESSAGES: Record<string, string> = {
  cpf_invalido: 'CPF inválido. Confira e tente novamente.',
  nascimento_obrigatorio: 'Informe a data de nascimento.',
  nascimento_invalido: 'Data de nascimento inválida.',
  not_found: 'Não encontramos nenhuma OS com estes dados.',
  missing_service_role: 'Consulta indisponível no momento. Tente novamente mais tarde.',
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
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: string }).message ?? '')
      : ''
  const normalized = message.toLowerCase()

  for (const [pattern, msg] of AUTH_ERROR_PATTERNS) {
    if (normalized.includes(pattern)) return msg
  }
  return fallback
}

/**
 * Converte um código de erro da busca de OS em mensagem amigável
 * @param errorCode - Código retornado pela API (ex: 'cpf_invalido')
 * @param fallback - Mensagem padrão quando o código não for conhecido
 */
export function getOsSearchErrorMessage(
  errorCode?: string | null,
  fallback = 'Não foi possível consultar agora. Tente novamente.'
): string {
  if (!errorCode) return fallback
  return OS_SEARCH_ERROR_MESSAGES[errorCode] ?? fallback
}
