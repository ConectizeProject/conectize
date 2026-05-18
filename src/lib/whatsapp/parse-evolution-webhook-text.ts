function pickTextFromMessageContent (m: Record<string, unknown>): string | null {
	if (typeof m.conversation === 'string' && m.conversation.trim()) {
		return m.conversation.trim()
	}
	if (typeof m.speechToText === 'string' && m.speechToText.trim()) {
		return m.speechToText.trim()
	}
	const ext = m.extendedTextMessage as Record<string, unknown> | undefined
	if (ext && typeof ext.text === 'string' && ext.text.trim()) {
		return ext.text.trim()
	}
	const img = m.imageMessage as Record<string, unknown> | undefined
	if (img && typeof img.caption === 'string' && img.caption.trim()) {
		return img.caption.trim()
	}
	const vid = m.videoMessage as Record<string, unknown> | undefined
	if (vid && typeof vid.caption === 'string' && vid.caption.trim()) {
		return vid.caption.trim()
	}
	const doc = m.documentMessage as Record<string, unknown> | undefined
	if (doc && typeof doc.caption === 'string' && doc.caption.trim()) {
		return doc.caption.trim()
	}
	const btn = m.buttonsResponseMessage as Record<string, unknown> | undefined
	if (
		btn &&
		typeof btn.selectedDisplayText === 'string' &&
		btn.selectedDisplayText.trim()
	) {
		return btn.selectedDisplayText.trim()
	}
	const list = m.listResponseMessage as Record<string, unknown> | undefined
	if (list) {
		const single = list.singleSelectReply as Record<string, unknown> | undefined
		if (single && typeof single.title === 'string' && single.title.trim()) {
			return single.title.trim()
		}
	}
	const dwc = m.documentWithCaptionMessage as Record<string, unknown> | undefined
	if (dwc?.message && typeof dwc.message === 'object') {
		const inner = dwc.message as Record<string, unknown>
		const innerDoc = inner.documentMessage as Record<string, unknown> | undefined
		if (
			innerDoc &&
			typeof innerDoc.caption === 'string' &&
			innerDoc.caption.trim()
		) {
			return innerDoc.caption.trim()
		}
	}
	return null
}

export function extractTextFromMessagePayload (
	msg: Record<string, unknown>,
): string | null {
	let m = msg.message as Record<string, unknown> | undefined
	if (!m || typeof m !== 'object') return null

	for (let depth = 0; depth < 5; depth++) {
		const text = pickTextFromMessageContent(m)
		if (text) return text
		const wrapped =
			(m.ephemeralMessage as Record<string, unknown> | undefined)?.message ??
			(m.viewOnceMessage as Record<string, unknown> | undefined)?.message ??
			(m.viewOnceMessageV2 as Record<string, unknown> | undefined)?.message
		if (!wrapped || typeof wrapped !== 'object') break
		m = wrapped as Record<string, unknown>
	}

	const mt = String(msg.messageType || '').trim()
	if (
		mt &&
		mt !== 'unknown' &&
		!mt.includes('protocol') &&
		!mt.includes('Reaction')
	) {
		return `[${mt}]`
	}
	return null
}

export function flattenMessages (raw: unknown): Record<string, unknown>[] {
	if (Array.isArray(raw)) {
		return raw.filter((x) => x && typeof x === 'object') as Record<
			string,
			unknown
		>[]
	}
	if (raw && typeof raw === 'object') {
		const o = raw as Record<string, unknown>
		const arr = o.messages
		if (Array.isArray(arr)) {
			return arr.filter((x) => x && typeof x === 'object') as Record<
				string,
				unknown
			>[]
		}
		if (o.key && typeof o.key === 'object') return [o]
	}
	return []
}
