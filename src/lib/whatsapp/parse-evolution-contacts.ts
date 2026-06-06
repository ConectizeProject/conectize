import {
	isGroupWaKey,
	normalizeWaConversationKey,
} from '@/lib/whatsapp/wa-conversation-key'

const SUFFIX_PREFIX = 'suffix:'

function registerContactName (
	map: Map<string, string>,
	rawJid: string,
	name: string,
) {
	const key = normalizeWaConversationKey(rawJid)
	if (!key || isGroupWaKey(key)) return

	const prev = map.get(key)
	if (!prev || name.length > prev.length) map.set(key, name)

	const digits = key.replace(/\D/g, '')
	if (digits.length >= 10) {
		const suffixKey = `${SUFFIX_PREFIX}${digits.slice(-11)}`
		const prevSuffix = map.get(suffixKey)
		if (!prevSuffix || name.length > prevSuffix.length) {
			map.set(suffixKey, name)
		}
	}
}

/** Mapa wa_from → nome exibido (pushName / agenda Evolution). */
export function parseEvolutionContactNameMap (
	raw: unknown[],
): Map<string, string> {
	const map = new Map<string, string>()

	for (const item of raw) {
		if (!item || typeof item !== 'object') continue
		const o = item as Record<string, unknown>
		if (o.isGroup === true) continue

		const name = String(o.pushName || o.name || '').trim()
		if (!name || name === 'Você') continue

		const jid = String(o.remoteJid || o.id || '').trim()
		if (jid) registerContactName(map, jid, name)
	}

	return map
}

/** Resolve nome da agenda Evolution para a chave da conversa no inbox. */
export function lookupEvolutionContactDisplayName (
	map: Map<string, string>,
	waKey: string,
): string | null {
	const key = normalizeWaConversationKey(waKey)
	if (!key) return null

	const direct = map.get(key)
	if (direct) return direct

	const digits = key.replace(/\D/g, '')
	if (digits.length >= 10) {
		return map.get(`${SUFFIX_PREFIX}${digits.slice(-11)}`) ?? null
	}

	return null
}
