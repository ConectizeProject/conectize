function stringifyEvolutionMessagePart (part: unknown): string {
	if (part == null) return ''
	if (typeof part === 'string') return part.trim()
	if (typeof part === 'number' || typeof part === 'boolean') return String(part)
	if (Array.isArray(part)) {
		return part.map(stringifyEvolutionMessagePart).filter(Boolean).join('; ')
	}
	if (typeof part === 'object') {
		const o = part as Record<string, unknown>
		const nested = o.message ?? o.error ?? o.description ?? o.reason
		if (nested != null) return stringifyEvolutionMessagePart(nested)
		try {
			return JSON.stringify(part)
		} catch {
			return ''
		}
	}
	return String(part).trim()
}

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
			const fromResp = stringifyEvolutionMessagePart(msg)
			if (fromResp) return fromResp
		}
		const top = stringifyEvolutionMessagePart(o.message)
		if (top) return top
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
			|| low.includes('sendmessage')
			|| low.includes('sessionerror')
			|| low.includes('no sessions')
		) {
			return 'A instância Evolution desta conversa está desconectada. No Hub, use a instância com status open (ex.: Victor), sincronize os grupos de novo e tente enviar outra vez.'
		}
		if (low.includes('@g.us') || low.includes('group')) {
			return 'Envio para grupo só funciona na instância Evolution conectada que recebeu as mensagens do grupo.'
		}
		if (low.includes('invalid') && low.includes('number')) {
			return 'Número inválido para envio. Sincronize de novo as conversas ou escolha outro contato.'
		}
	}

	if (
		low.includes('fetch_failed')
		|| low.includes('fetch failed')
		|| low.includes('econnrefused')
		|| low.includes('enotfound')
		|| low.includes('etimedout')
	) {
		return 'O servidor Next não alcançou a Evolution API. Em produção (Vercel), WHATSAPP_EVOLUTION_API_URL deve ser uma URL pública (não localhost). Confira também WHATSAPP_EVOLUTION_API_KEY e se o Docker/servidor Evolution está no ar.'
	}

	return undefined
}
