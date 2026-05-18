/** Extrai mensagem legível de erro JSON da Evolution API. */
export function formatEvolutionApiError (
	data: unknown,
	fallbackStatus: number,
): string {
	if (data && typeof data === 'object') {
		const o = data as Record<string, unknown>
		const resp = o.response
		if (resp && typeof resp === 'object') {
			const msg = (resp as { message?: unknown }).message
			if (Array.isArray(msg)) {
				const joined = msg.map((m) => String(m)).filter(Boolean).join('; ')
				if (joined) return joined
			}
			if (typeof msg === 'string' && msg.trim()) return msg.trim()
		}
		if (typeof o.message === 'string' && o.message.trim()) return o.message.trim()
		if (typeof o.error === 'string' && o.error.trim()) return o.error.trim()
	}
	return `http_${fallbackStatus}`
}

export function hintForWhatsappSendError (
	error: string,
	provider: 'evolution' | 'cloud',
): string | undefined {
	const low = error.toLowerCase()

	if (provider === 'evolution') {
		if (low.includes('unauthorized') || low === 'http_401') {
			return 'API key da Evolution inválida no hub. No Hub → Evolution, informe a mesma chave de AUTHENTICATION_API_KEY do Docker (ou deixe vazio se WHATSAPP_EVOLUTION_API_KEY estiver no .env).'
		}
		if (
			low.includes('connection closed')
			|| low.includes('not connected')
			|| low.includes('disconnected')
		) {
			return 'A instância Evolution está desconectada. Abra o manager da Evolution, escaneie o QR Code da instância ou reinicie o container.'
		}
		if (low.includes('invalid') && low.includes('number')) {
			return 'Número inválido para envio. Sincronize de novo as conversas ou escolha outro contato.'
		}
	}

	if (low.includes('fetch_failed') || low.includes('econnrefused')) {
		return 'O servidor Next não alcançou a Evolution API. Confira WHATSAPP_EVOLUTION_API_URL e se o Docker está rodando.'
	}

	return undefined
}
