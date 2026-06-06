/** Parsing de webhooks Evolution (compat + diagnóstico). */

import { resolveInboundConversationKey } from '@/lib/whatsapp/wa-conversation-key'
import {
	normalizeEvolutionEventName,
	isEvolutionMessagesUpsertEvent as isUpsertEventName,
} from '@/lib/whatsapp/normalize-evolution-event'
import {
	extractTextFromMessagePayload,
	flattenMessages,
} from '@/lib/whatsapp/parse-evolution-webhook-text'
import { parseEvolutionMessageUpserts } from '@/lib/whatsapp/parse-evolution-webhook-messages'

export { extractTextFromMessagePayload, flattenMessages } from '@/lib/whatsapp/parse-evolution-webhook-text'

export type EvolutionInboundNormalized = {
	instance: string
	waMessageId: string
	conversationKey: string
	text: string
	isGroup: boolean
	senderDisplayName: string | null
}

export function isEvolutionMessagesUpsertEvent (
	payload: Record<string, unknown>,
): boolean {
	return isUpsertEventName(normalizeEvolutionEventName(payload.event))
}

export function analyzeEvolutionWebhookPayload (
	payload: Record<string, unknown>,
): {
	is_messages_upsert: boolean
	instance: string | null
	parsed_inbound_count: number
	data_shape: string
	message_type: string | null
	from_me: boolean | null
	has_extractable_text: boolean
} {
	const items = flattenMessages(payload.data)
	const first = items[0]
	const key = first?.key as Record<string, unknown> | undefined
	const parsed = parseEvolutionInboundMessages(payload)

	let dataShape = 'empty'
	if (Array.isArray(payload.data)) dataShape = 'array'
	else if (items.length > 0 && items[0]?.key) dataShape = 'single_message'
	else if (payload.data && typeof payload.data === 'object') {
		dataShape = `object_keys:${Object.keys(payload.data as object)
			.slice(0, 6)
			.join(',')}`
	}

	return {
		is_messages_upsert: isEvolutionMessagesUpsertEvent(payload),
		instance: typeof payload.instance === 'string' ? payload.instance : null,
		parsed_inbound_count: parsed.length,
		data_shape: dataShape,
		message_type: first ? String(first.messageType || '') || null : null,
		from_me:
			key?.fromMe === true || key?.fromMe === 'true'
				? true
				: key?.fromMe === false || key?.fromMe === 'false'
					? false
					: null,
		has_extractable_text: Boolean(
			first && extractTextFromMessagePayload(first),
		),
	}
}

/** Apenas mensagens de entrada (legado / diagnóstico). */
export function parseEvolutionInboundMessages (
	payload: Record<string, unknown>,
): EvolutionInboundNormalized[] {
	if (!isEvolutionMessagesUpsertEvent(payload)) return []

	return parseEvolutionMessageUpserts(payload)
		.filter((m) => m.direction === 'in')
		.map((m) => ({
			instance: m.instance,
			waMessageId: m.waMessageId,
			conversationKey: m.conversationKey,
			text: m.text,
			isGroup: m.isGroup,
			senderDisplayName: m.senderDisplayName,
		}))
}
