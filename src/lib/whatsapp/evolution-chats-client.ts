export type FetchEvolutionChatsResult =
	| { ok: true; chats: unknown[] }
	| { ok: false; error: string; status?: number }

/**
 * Evolution API v2 — lista chats (1:1 e grupos).
 * @see https://doc.evolution-api.com/v2/api-reference/chat-controller/find-chats
 */
export async function fetchEvolutionChats(opts: {
	baseUrl: string
	apiKey: string
	instanceName: string
}): Promise<FetchEvolutionChatsResult> {
	const { baseUrl, apiKey, instanceName } = opts
	const trimmedBase = baseUrl.replace(/\/$/, '')
	const encoded = encodeURIComponent(instanceName)
	const url = `${trimmedBase}/chat/findChats/${encoded}`

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: apiKey,
			},
			body: JSON.stringify({}),
		})
		const data = await res.json().catch(() => null)
		if (!res.ok) {
			const err =
				data && typeof data === 'object'
					? JSON.stringify(data)
					: `http_${res.status}`
			return { ok: false, error: err, status: res.status }
		}

		const chats = unwrapChatsArray(data)
		return { ok: true, chats }
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch_failed'
		return { ok: false, error: msg }
	}
}

function unwrapChatsArray(data: unknown): unknown[] {
	if (Array.isArray(data)) return data
	if (data && typeof data === 'object') {
		const o = data as Record<string, unknown>
		for (const key of ['chats', 'data', 'result', 'response']) {
			const v = o[key]
			if (Array.isArray(v)) return v
		}
	}
	return []
}
