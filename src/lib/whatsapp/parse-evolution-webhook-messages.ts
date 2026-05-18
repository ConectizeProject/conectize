import { resolveInboundConversationKey } from '@/lib/whatsapp/wa-conversation-key'
import {
	extractTextFromMessagePayload,
	flattenMessages,
} from '@/lib/whatsapp/parse-evolution-webhook-text'

export type EvolutionMessageUpsert = {
	instance: string
	waMessageId: string
	stableWaMessageId: string
	conversationKey: string
	text: string
	isGroup: boolean
	direction: 'in' | 'out'
	senderDisplayName: string | null
	messageTimestamp: string | null
}

export type EvolutionMessageDelete = {
	instance: string
	waMessageId: string
	stableWaMessageId: string
	conversationKey: string
}

function parseMessageTimestamp (item: Record<string, unknown>): string | null {
	const raw = item.messageTimestamp ?? item.message_timestamp
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const ms = raw > 1e12 ? raw : raw * 1000
		return new Date(ms).toISOString()
	}
	if (typeof raw === 'object' && raw !== null && 'low' in raw) {
		const low = Number((raw as { low?: number }).low)
		if (Number.isFinite(low)) {
			const ms = low > 1e12 ? low : low * 1000
			return new Date(ms).toISOString()
		}
	}
	return null
}

function isFromMe (key: Record<string, unknown>): boolean {
	return key.fromMe === true || key.fromMe === 'true'
}

export function buildStableWaMessageId (
	instance: string,
	messageId: string,
): string {
	return `${instance}:${messageId}`
}

/** Mensagens com texto (entrada e saída) em MESSAGES_UPSERT / SEND_MESSAGE. */
export function parseEvolutionMessageUpserts (
	payload: Record<string, unknown>,
): EvolutionMessageUpsert[] {
	const instance = String(payload.instance || '').trim()
	if (!instance) return []

	const data = payload.data as unknown
	const out: EvolutionMessageUpsert[] = []

	for (const item of flattenMessages(data)) {
		const key = item.key as Record<string, unknown> | undefined
		if (!key || typeof key !== 'object') continue

		const rid = String(key.remoteJid || key.remoteJidAlt || '')
		if (rid.includes('@broadcast')) continue

		const id = String(key.id || '').trim()
		if (!id) continue

		const conversationKey = resolveInboundConversationKey(
			key.remoteJid,
			key.remoteJidAlt,
		)
		if (!conversationKey) continue

		const text = extractTextFromMessagePayload(item)
		if (!text) continue

		const fromMe = isFromMe(key)
		const rawPush = String(item.pushName || '').trim()
		const senderDisplayName =
			!fromMe && rawPush && rawPush !== 'Você' ? rawPush : null

		out.push({
			instance,
			waMessageId: id,
			stableWaMessageId: buildStableWaMessageId(instance, id),
			conversationKey,
			text,
			isGroup: conversationKey.includes('@g.us'),
			direction: fromMe ? 'out' : 'in',
			senderDisplayName,
			messageTimestamp: parseMessageTimestamp(item),
		})
	}

	return out
}

export function parseEvolutionMessageDeletes (
	payload: Record<string, unknown>,
): EvolutionMessageDelete[] {
	const instance = String(payload.instance || '').trim()
	if (!instance) return []

	const data = payload.data as unknown
	const out: EvolutionMessageDelete[] = []

	for (const item of flattenMessages(data)) {
		const key = item.key as Record<string, unknown> | undefined
		if (!key || typeof key !== 'object') continue

		const id = String(key.id || item.id || '').trim()
		if (!id) continue

		const conversationKey = resolveInboundConversationKey(
			key.remoteJid,
			key.remoteJidAlt,
		)
		if (!conversationKey) continue

		out.push({
			instance,
			waMessageId: id,
			stableWaMessageId: buildStableWaMessageId(instance, id),
			conversationKey,
		})
	}

	return out
}
