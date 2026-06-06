export type FetchEvolutionContactsResult =
	| { ok: true; contacts: unknown[] }
	| { ok: false; error: string; status?: number }

/**
 * Evolution API v2 — agenda/contatos da instância (pushName).
 * @see https://doc.evolution-api.com/v2/api-reference/chat-controller/find-contacts
 */
export async function fetchEvolutionContacts (opts: {
	baseUrl: string
	apiKey: string
	instanceName: string
}): Promise<FetchEvolutionContactsResult> {
	const { baseUrl, apiKey, instanceName } = opts
	const trimmedBase = baseUrl.replace(/\/$/, '')
	const encoded = encodeURIComponent(instanceName)
	const url = `${trimmedBase}/chat/findContacts/${encoded}`

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: apiKey,
			},
			body: JSON.stringify({ where: {} }),
		})
		const data = await res.json().catch(() => null)
		if (!res.ok) {
			const err =
				data && typeof data === 'object'
					? JSON.stringify(data)
					: `http_${res.status}`
			return { ok: false, error: err, status: res.status }
		}

		const contacts = unwrapContactsArray(data)
		return { ok: true, contacts }
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch_failed'
		return { ok: false, error: msg }
	}
}

function unwrapContactsArray (data: unknown): unknown[] {
	if (Array.isArray(data)) return data
	if (data && typeof data === 'object') {
		const o = data as Record<string, unknown>
		for (const key of ['contacts', 'data', 'result', 'response']) {
			const v = o[key]
			if (Array.isArray(v)) return v
		}
	}
	return []
}
