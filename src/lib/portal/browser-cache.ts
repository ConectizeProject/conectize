/**
 * Cache de UX no browser (sessionStorage / localStorage).
 * Source of truth offline = IndexedDB (`src/lib/pdv/offline`).
 * Aqui: TTLs curtos, sempre scoped por organizationId.
 */

export type BrowserCacheStorageKind = 'session' | 'local'

type BrowserCacheEnvelope<T> = {
  savedAt: number
  data: T
}

function getStorage (kind: BrowserCacheStorageKind): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

export function browserCacheKey (
  namespace: string,
  organizationId: string,
  suffix?: string | null,
) {
  const extra = String(suffix || '').trim()
  return extra
    ? `conectize:${namespace}:v1:${organizationId}:${extra}`
    : `conectize:${namespace}:v1:${organizationId}`
}

export function readBrowserCache<T> (input: {
  kind: BrowserCacheStorageKind
  namespace: string
  organizationId: string | null | undefined
  suffix?: string | null
  ttlMs: number
  validate: (data: unknown) => data is T
}): T | null {
  const organizationId = String(input.organizationId || '').trim()
  if (!organizationId) return null
  const storage = getStorage(input.kind)
  if (!storage) return null
  try {
    const raw = storage.getItem(browserCacheKey(input.namespace, organizationId, input.suffix))
    if (!raw) return null
    const parsed = JSON.parse(raw) as BrowserCacheEnvelope<unknown>
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > input.ttlMs) return null
    if (!input.validate(parsed.data)) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeBrowserCache<T> (input: {
  kind: BrowserCacheStorageKind
  namespace: string
  organizationId: string | null | undefined
  suffix?: string | null
  data: T
}) {
  const organizationId = String(input.organizationId || '').trim()
  if (!organizationId) return
  const storage = getStorage(input.kind)
  if (!storage) return
  try {
    const payload: BrowserCacheEnvelope<T> = {
      savedAt: Date.now(),
      data: input.data,
    }
    storage.setItem(
      browserCacheKey(input.namespace, organizationId, input.suffix),
      JSON.stringify(payload),
    )
  } catch {
    // Quota / private mode
  }
}

export function removeBrowserCache (input: {
  kind: BrowserCacheStorageKind
  namespace: string
  organizationId: string | null | undefined
  suffix?: string | null
}) {
  const organizationId = String(input.organizationId || '').trim()
  if (!organizationId) return
  const storage = getStorage(input.kind)
  if (!storage) return
  try {
    storage.removeItem(browserCacheKey(input.namespace, organizationId, input.suffix))
  } catch {
    // ignore
  }
}

export function clearBrowserCacheNamespace (namespace: string) {
  if (typeof window === 'undefined') return
  const prefix = `conectize:${namespace}:v1:`
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const keys: string[] = []
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i)
        if (key && key.startsWith(prefix)) keys.push(key)
      }
      for (const key of keys) storage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
