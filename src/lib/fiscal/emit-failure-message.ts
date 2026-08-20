/** Mensagem amigável quando a API de emissão fiscal falha no browser. */
export function fiscalEmitFailureMessage (
  res: Response | null | undefined,
  data: { message?: unknown, error?: unknown } | null | undefined,
  kind = 'NFC-e',
) {
  const fromApi = String(data?.message || '').trim()
  if (fromApi) return fromApi

  const code = data?.error
  if (typeof code === 'string' && code.trim()) {
    if (code === 'forbidden') return `Seu usuário não tem permissão para emitir ${kind}.`
    if (code === 'not_authenticated') return 'Sessão expirada. Entre novamente e tente emitir.'
    if (code === 'no_organization_context') {
      return 'Empresa ativa não encontrada. Selecione a empresa e tente de novo.'
    }
    return code
  }

  const status = res?.status ?? 0
  if (status === 504 || status === 408) {
    return `A SEFAZ demorou demais para responder (timeout). A ${kind} pode ter sido autorizada — consulte o documento antes de reenviar.`
  }
  if (status === 502 || status === 503) {
    return `Falha de comunicação com a SEFAZ. Tente emitir a ${kind} novamente em instantes.`
  }
  if (status >= 500) {
    return `Erro no servidor ao emitir a ${kind}. Tente novamente; se persistir, avise o administrador.`
  }
  if (!res) {
    return `Não foi possível falar com o servidor para emitir a ${kind}.`
  }

  return `Não foi possível emitir a ${kind}.`
}
