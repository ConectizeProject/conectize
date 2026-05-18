import type { SendTextMessageResult } from '@/lib/whatsapp/whatsapp-cloud-client'
import { formatEvolutionApiError } from '@/lib/whatsapp/evolution-send-errors'
import {
	isGroupWaKey,
	toEvolutionSendTarget,
} from '@/lib/whatsapp/wa-conversation-key'

/**
 * Evolution API v2 — envio de texto via Baileys.
 * @see https://doc.evolution-api.com/v2/api-reference/message-controller/send-text.md
 */
export async function sendEvolutionTextMessage(opts: {
	baseUrl: string
	apiKey: string
	instanceName: string
	/** Telefone (dígitos / E.164) ou JID de grupo (`…@g.us`). */
	toTarget: string
	body: string
}): Promise<SendTextMessageResult> {
	const { baseUrl, apiKey, instanceName, toTarget, body } = opts
	const number = toEvolutionSendTarget(toTarget)
	if (!body.trim()) {
		return { ok: false, error: 'invalid_params' }
	}
	if (!number) {
		return { ok: false, error: 'invalid_recipient' }
	}
	if (!isGroupWaKey(toTarget)) {
		const digits = number.replace(/\D/g, '')
		if (digits.length < 10 || digits.length > 15) {
			return { ok: false, error: 'invalid_recipient' }
		}
	}
	const trimmedBase = baseUrl.replace(/\/$/, '')
	const encoded = encodeURIComponent(instanceName)
	const url = `${trimmedBase}/message/sendText/${encoded}`
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: apiKey,
			},
			body: JSON.stringify({
				number,
				text: body.slice(0, 4096),
			}),
		})
		const data = (await res.json().catch(() => null)) as Record<
			string,
			unknown
		> | null
		if (!res.ok) {
			return {
				ok: false,
				error: formatEvolutionApiError(data, res.status),
				status: res.status,
			}
		}
		const mid =
			data &&
			typeof data === 'object' &&
			'key' in data &&
			typeof (data as { key?: unknown }).key === 'object' &&
			(data as { key?: { id?: string } }).key != null
				? String((data as { key: { id?: string } }).key.id ?? '')
				: ''
		return { ok: true, messageId: mid || undefined }
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch_failed'
		return { ok: false, error: msg }
	}
}
