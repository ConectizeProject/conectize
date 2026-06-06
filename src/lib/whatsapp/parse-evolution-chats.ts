import {
	isGroupWaKey,
	normalizeWaConversationKey,
	resolveInboundConversationKey,
} from '@/lib/whatsapp/wa-conversation-key'

export type ParsedEvolutionChat = {
	waKey: string
	displayName: string | null
	lastMessageAt: string | null
	isGroup: boolean
}

function parseTimestamp(raw: unknown): string | null {
	if (raw == null) return null
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
	const s = String(raw).trim()
	if (!s) return null
	const d = new Date(s)
	return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function parseEvolutionChatList(raw: unknown[]): ParsedEvolutionChat[] {
	const out: ParsedEvolutionChat[] = []
	const seen = new Set<string>()

	for (const item of raw) {
		if (!item || typeof item !== 'object') continue
		const o = item as Record<string, unknown>
		const lastMsg = o.lastMessage as Record<string, unknown> | undefined
		const lastKey =
			lastMsg?.key && typeof lastMsg.key === 'object'
				? (lastMsg.key as Record<string, unknown>)
				: undefined
		const jidPrimary = String(
			o.remoteJid ??
				o.id ??
				o.jid ??
				lastKey?.remoteJid ??
				'',
		).trim()
		const jidAlt = String(
			o.remoteJidAlt ??
				lastKey?.remoteJidAlt ??
				lastKey?.participantAlt ??
				'',
		).trim()
		const waKey = jidPrimary.includes('@g.us')
			? normalizeWaConversationKey(jidPrimary)
			: resolveInboundConversationKey(jidPrimary, jidAlt)
		if (!waKey || seen.has(waKey)) continue
		seen.add(waKey)

		const isGroup = isGroupWaKey(waKey)
		const lastFromMe =
			lastKey?.fromMe === true || lastKey?.fromMe === 'true'
		const lastSenderName =
			!lastFromMe ? String(lastMsg?.pushName || '').trim() : ''

		const displayName =
			String(
				o.pushName ??
					o.name ??
					o.subject ??
					(isGroup ? o.groupName : null) ??
					lastSenderName ??
					'',
			).trim() || null

		const lastMessageAt =
			parseTimestamp(
				o.lastMsgTimestamp ??
					o.lastMessageTimestamp ??
					o.conversationTimestamp ??
					o.updatedAt ??
					lastMsg?.messageTimestamp,
			) ?? null

		out.push({ waKey, displayName, lastMessageAt, isGroup })
	}

	return out
}
