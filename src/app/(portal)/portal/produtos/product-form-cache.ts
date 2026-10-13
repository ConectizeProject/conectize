'use client'

const FRESH_MS = 20_000
const HOVER_MS = 160

export type ProductFormCachePayload = {
	product: { id: string }
	variations: unknown[]
	compatibleModels: { id: string; label: string }[]
}

type CacheEntry = {
	at: number
	data: ProductFormCachePayload
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ProductFormCachePayload | null>>()
const hoverTimers = new Map<string, number>()

function normalizeId (id: string) {
	return String(id || '').trim()
}

export function readProductFormCache (
	id: string,
): ProductFormCachePayload | null {
	const hit = cache.get(normalizeId(id))
	return hit?.data ?? null
}

export function isProductFormCacheFresh (id: string): boolean {
	const hit = cache.get(normalizeId(id))
	if (!hit) return false
	return Date.now() - hit.at < FRESH_MS
}

export function forgetProductFormCache (id: string) {
	const key = normalizeId(id)
	cache.delete(key)
	cancelProductFormPrefetch(key)
}

function remember (id: string, data: ProductFormCachePayload) {
	cache.set(id, { at: Date.now(), data })
}

async function requestProductForm (
	id: string,
): Promise<ProductFormCachePayload> {
	const res = await fetch(`/api/portal/produtos/${id}`)
	const data = (await res.json().catch(() => null)) as {
		ok?: boolean
		error?: unknown
		message?: unknown
		product?: ProductFormCachePayload['product']
		variations?: unknown
		compatibleModels?: unknown
	} | null
	if (!res.ok || !data?.ok || !data.product?.id) {
		const message =
			typeof data?.message === 'string'
				? data.message
				: typeof data?.error === 'string'
					? data.error
					: 'Não foi possível carregar o item.'
		throw new Error(message)
	}
	const payload: ProductFormCachePayload = {
		product: data.product,
		variations: Array.isArray(data.variations) ? data.variations : [],
		compatibleModels: Array.isArray(data.compatibleModels)
			? (data.compatibleModels as ProductFormCachePayload['compatibleModels'])
			: [],
	}
	remember(id, payload)
	return payload
}

export function loadProductForm (
	id: string,
	opts?: { force?: boolean },
): Promise<ProductFormCachePayload | null> {
	const key = normalizeId(id)
	if (!key) return Promise.resolve(null)
	if (!opts?.force && isProductFormCacheFresh(key)) {
		return Promise.resolve(cache.get(key)?.data ?? null)
	}
	const existing = inflight.get(key)
	if (existing && !opts?.force) return existing
	const promise = requestProductForm(key).finally(() => {
		if (inflight.get(key) === promise) inflight.delete(key)
	}) as Promise<ProductFormCachePayload | null>
	inflight.set(key, promise)
	return promise
}

export function prefetchProductForm (id: string) {
	const key = normalizeId(id)
	if (!key) return
	if (isProductFormCacheFresh(key) || inflight.has(key)) return
	void loadProductForm(key).catch(() => {})
}

export function scheduleProductFormPrefetch (id: string) {
	const key = normalizeId(id)
	if (
		!key ||
		isProductFormCacheFresh(key) ||
		inflight.has(key) ||
		hoverTimers.has(key)
	) {
		return
	}
	const timer = window.setTimeout(() => {
		hoverTimers.delete(key)
		prefetchProductForm(key)
	}, HOVER_MS)
	hoverTimers.set(key, timer)
}

export function cancelProductFormPrefetch (id: string) {
	const key = normalizeId(id)
	const timer = hoverTimers.get(key)
	if (timer == null) return
	window.clearTimeout(timer)
	hoverTimers.delete(key)
}
