/** Identificador estável de conversa no inbox (telefone E.164 ou JID de grupo). */

export function isGroupWaKey(waKey: string): boolean {
	return String(waKey || '').includes('@g.us')
}

export function normalizeWaFrom(raw: string): string {
	const d = String(raw || '').replace(/\D/g, '')
	if (!d) return ''
	if (d.length >= 10 && d.length <= 13)
		return d.startsWith('55') ? `+${d}` : `+55${d}`
	return `+${d}`
}

export function normalizeWaConversationKey(raw: string): string {
	const s = String(raw || '').trim()
	if (!s) return ''
	if (s.includes('@broadcast')) return ''
	if (s.includes('@g.us')) {
		const id = s.split('@')[0]?.replace(/\D/g, '') || ''
		return id ? `${id}@g.us` : ''
	}
	return normalizeWaFrom(s)
}

/** Destino para Evolution `sendText` (grupo = JID; 1:1 = só dígitos). */
export function toEvolutionSendTarget(waKey: string): string {
	if (isGroupWaKey(waKey)) return waKey
	return waKey.replace(/\D/g, '')
}

export function formatWaConversationLabel(
	waKey: string,
	state?: { display_name?: string | null; is_group?: boolean } | null,
): string {
	const name = String(state?.display_name || '').trim()
	if (name) return name
	if (isGroupWaKey(waKey))
		return `Grupo ${waKey.split('@')[0]?.slice(-6) ?? ''}`
	return waKey
}

export function resolveInboundConversationKey(
	remoteJid: unknown,
	remoteJidAlt: unknown,
): string {
	const primary = String(remoteJid || '').trim()
	const alt = String(remoteJidAlt || '').trim()
	if (primary.includes('@g.us')) return normalizeWaConversationKey(primary)
	if (alt.includes('@g.us')) return normalizeWaConversationKey(alt)
	const use = primary.includes('@lid') && alt ? alt : primary || alt
	return normalizeWaConversationKey(use)
}
