import {
	isGroupWaKey,
	normalizeWaConversationKey,
} from '@/lib/whatsapp/wa-conversation-key'

/** Mapa wa_from → nome exibido (pushName / agenda). */
export function parseEvolutionContactNameMap (
	raw: unknown[],
): Map<string, string> {
	const map = new Map<string, string>()

	for (const item of raw) {
		if (!item || typeof item !== 'object') continue
		const o = item as Record<string, unknown>
		if (o.isGroup === true) continue

		const jid = String(o.remoteJid || o.id || '').trim()
		const waKey = normalizeWaConversationKey(jid)
		if (!waKey || isGroupWaKey(waKey)) continue

		const name = String(o.pushName || o.name || '').trim()
		if (!name || name === 'Você') continue

		const prev = map.get(waKey)
		if (!prev || name.length > prev.length) map.set(waKey, name)
	}

	return map
}
