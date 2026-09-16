import { readBrowserCache, writeBrowserCache } from '@/lib/portal/browser-cache'

const TTL_MS = 24 * 60 * 60 * 1000
const NAMESPACE = 'os:service-suggestions'

function isUuidLike (value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function readServiceSuggestionsCache (
  organizationId: string | null | undefined,
  deviceModelId: string | null | undefined,
): string[] | null {
  const productIds = readBrowserCache<string[]>({
    kind: 'session',
    namespace: NAMESPACE,
    organizationId,
    suffix: String(deviceModelId || '').trim() || 'none',
    ttlMs: TTL_MS,
    validate: (data): data is string[] => Array.isArray(data) && data.every(isUuidLike),
  })
  if (!productIds?.length) return null
  return productIds.slice(0, 5)
}

export function writeServiceSuggestionsCache (
  organizationId: string | null | undefined,
  deviceModelId: string | null | undefined,
  productIds: string[],
) {
  writeBrowserCache({
    kind: 'session',
    namespace: NAMESPACE,
    organizationId,
    suffix: String(deviceModelId || '').trim() || 'none',
    data: productIds.filter(isUuidLike).slice(0, 5),
  })
}
