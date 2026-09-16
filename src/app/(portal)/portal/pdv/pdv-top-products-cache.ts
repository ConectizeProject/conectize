import type { CatalogProduct } from './pdv-types'
import { readBrowserCache, writeBrowserCache } from '@/lib/portal/browser-cache'

const TTL_MS = 24 * 60 * 60 * 1000
const NAMESPACE = 'pdv:top-products'

function isCatalogProduct (value: unknown): value is CatalogProduct {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && row.id.length > 0 && typeof row.name === 'string'
}

function stripSensitive (product: CatalogProduct): CatalogProduct {
  const { cost_price_cents: _cost, ...rest } = product
  return rest
}

export function readTopProductsCache (organizationId: string | null | undefined): CatalogProduct[] | null {
  const products = readBrowserCache<CatalogProduct[]>({
    kind: 'local',
    namespace: NAMESPACE,
    organizationId,
    ttlMs: TTL_MS,
    validate: (data): data is CatalogProduct[] => (
      Array.isArray(data) && data.every(isCatalogProduct)
    ),
  })
  if (!products?.length) return null
  return products.slice(0, 5).map(stripSensitive)
}

export function writeTopProductsCache (
  organizationId: string | null | undefined,
  products: CatalogProduct[],
) {
  writeBrowserCache({
    kind: 'local',
    namespace: NAMESPACE,
    organizationId,
    data: products.filter(isCatalogProduct).slice(0, 5).map(stripSensitive),
  })
}
