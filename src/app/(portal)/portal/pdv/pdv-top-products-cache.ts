import type { CatalogProduct } from './pdv-types'

const TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_PREFIX = 'conectize:pdv:top-products:v1:'

type TopProductsCachePayload = {
  savedAt: number
  products: CatalogProduct[]
}

function storageKey (organizationId: string) {
  return `${STORAGE_PREFIX}${organizationId}`
}

function isCatalogProduct (value: unknown): value is CatalogProduct {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && row.id.length > 0 && typeof row.name === 'string'
}

export function readTopProductsCache (organizationId: string | null | undefined): CatalogProduct[] | null {
  if (!organizationId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(organizationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TopProductsCachePayload
    if (!parsed || !Array.isArray(parsed.products) || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > TTL_MS) return null
    const products = parsed.products.filter(isCatalogProduct).slice(0, 5)
    return products.length > 0 ? products : null
  } catch {
    return null
  }
}

export function writeTopProductsCache (
  organizationId: string | null | undefined,
  products: CatalogProduct[],
) {
  if (!organizationId || typeof window === 'undefined') return
  try {
    const payload: TopProductsCachePayload = {
      savedAt: Date.now(),
      products: products.slice(0, 5),
    }
    window.localStorage.setItem(storageKey(organizationId), JSON.stringify(payload))
  } catch {
    // Quota / private mode — ignora.
  }
}
