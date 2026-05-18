/** Normaliza nome do evento Evolution (MESSAGES_UPSERT, messages.upsert, URL path). */
export function normalizeEvolutionEventName (raw: unknown): string {
	const s = String(raw || '')
		.trim()
		.toUpperCase()
		.replace(/\./g, '_')
		.replace(/-/g, '_')
	return s
}

export function isEvolutionMessagesUpsertEvent (event: string): boolean {
	return event.includes('MESSAGES') && event.includes('UPSERT')
}

export function isEvolutionSendMessageEvent (event: string): boolean {
	return event === 'SEND_MESSAGE' || event.includes('SEND_MESSAGE')
}

export function isEvolutionMessagesDeleteEvent (event: string): boolean {
	return event.includes('MESSAGES') && event.includes('DELETE')
}

export function isEvolutionMessagesUpdateEvent (event: string): boolean {
	return event.includes('MESSAGES') && event.includes('UPDATE')
}
