export type SendTextMessageResult =
	| { ok: true; messageId?: string }
	| { ok: false; error: string; status?: number }

/**
 * Type guard para unions discriminadas por `ok`.
 *
 * Não use `if (!result.ok)` para acessar `result.error`: o TypeScript
 * estreita só a propriedade `ok`, não o objeto inteiro. Com
 * `result.ok === false` (ou este helper), o discriminante fecha o union
 * e `error` passa a existir no tipo.
 */
export function isSendFailure<T extends { ok: true | false }> (
  result: T,
): result is Extract<T, { ok: false }> {
  return result.ok === false
}

export function isSendSuccess<T extends { ok: true | false }> (
  result: T,
): result is Extract<T, { ok: true }> {
  return result.ok === true
}

/**
 * Envia mensagem de texto via WhatsApp Cloud API.
 */
export async function sendWhatsAppTextMessage(opts: {
	phoneNumberId: string
	accessToken: string
	toE164Digits: string
	body: string
}): Promise<SendTextMessageResult> {
	const { phoneNumberId, accessToken, toE164Digits, body } = opts
	const to = toE164Digits.replace(/\D/g, '')
	if (!to || !body.trim()) {
		return { ok: false, error: 'invalid_params' }
	}
	const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'
	const url = `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				messaging_product: 'whatsapp',
				to,
				type: 'text',
				text: { body: body.slice(0, 4096) },
			}),
		})
		const data = await res.json().catch(() => null)
		if (!res.ok) {
			const err =
				(data && typeof data === 'object' && 'error' in data
					? JSON.stringify((data as { error?: unknown }).error)
					: null) || `http_${res.status}`
			return { ok: false, error: err, status: res.status }
		}
		const mid =
			data &&
			typeof data === 'object' &&
			'messages' in data &&
			Array.isArray((data as { messages?: { id?: string }[] }).messages)
				? (data as { messages: { id?: string }[] }).messages[0]?.id
				: undefined
		return { ok: true, messageId: mid }
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch_failed'
		return { ok: false, error: msg }
	}
}
