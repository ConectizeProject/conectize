const MIN_GAP_MS = 360

type PaceBucket = {
	nextAt: number
	tail: Promise<void>
}

const buckets = new Map<string, PaceBucket>()

function bucketFor (key: string) {
	const existing = buckets.get(key)
	if (existing) return existing
	const created: PaceBucket = { nextAt: 0, tail: Promise.resolve() }
	buckets.set(key, created)
	return created
}

function sleep (ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms)
	})
}

/** Espaça chamadas da mesma conta para ficar abaixo de 3 req/s do Bling. */
export async function paceBlingAccount (key: string) {
	const bucket = bucketFor(key)
	const ticket = bucket.tail.then(async () => {
		const wait = bucket.nextAt - Date.now()
		if (wait > 0) await sleep(wait)
		bucket.nextAt = Date.now() + MIN_GAP_MS
	})
	bucket.tail = ticket.then(() => undefined, () => undefined)
	await ticket
}

/** Empurra a próxima chamada depois de um 429 (Retry-After ou backoff). */
export function holdBlingAccount (key: string, ms: number) {
	const bucket = bucketFor(key)
	bucket.nextAt = Math.max(bucket.nextAt, Date.now() + Math.max(0, ms))
}

export function blingRetryDelayMs (retryAfterHeader: string | null, attempt: number) {
	const headerSeconds = Number(retryAfterHeader)
	if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
		return Math.min(Math.round(headerSeconds * 1000), 15000)
	}
	return Math.min(1000 * Math.max(1, attempt), 8000)
}

export function isBlingTooManyRequests (status: number, message: string) {
	if (status === 429) return true
	const normalized = message.toLowerCase()
	return normalized.includes('too many')
		|| normalized.includes('too_many')
		|| normalized.includes('muitas requisi')
}

export const BLING_TOO_MANY_REQUESTS = 'bling_too_many_requests'
