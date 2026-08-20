import { idbGet, idbPut, STORES } from './idb'
import type {
  PdvOfflineCatalogSnapshot,
  PdvOfflinePaymentMethodsSnapshot,
} from './types'

type CachedCatalogProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  cost_price_cents?: number | null
  image_url: string | null
  stock: number
  kind?: 'product' | 'service'
}

type CachedPaymentMethod = {
  id: string
  description: string
  type: string
  credit_installment_fees?: unknown
}

function isCatalogProduct (row: unknown): row is CachedCatalogProduct {
  if (!row || typeof row !== 'object') return false
  const r = row as CachedCatalogProduct
  return typeof r.id === 'string' && typeof r.name === 'string'
}

function isPaymentMethod (row: unknown): row is CachedPaymentMethod {
  if (!row || typeof row !== 'object') return false
  const r = row as CachedPaymentMethod
  return typeof r.id === 'string' && typeof r.description === 'string' && typeof r.type === 'string'
}

export async function writeOfflineCatalog (
  organizationId: string,
  products: CachedCatalogProduct[],
) {
  if (!organizationId) return
  const snapshot: PdvOfflineCatalogSnapshot = {
    organizationId,
    updatedAt: new Date().toISOString(),
    products,
  }
  try {
    await idbPut(STORES.catalog, snapshot)
  } catch {
    // Quota / private mode — ignora.
  }
}

export async function readOfflineCatalog (
  organizationId: string,
): Promise<CachedCatalogProduct[] | null> {
  if (!organizationId) return null
  try {
    const snapshot = await idbGet<PdvOfflineCatalogSnapshot>(STORES.catalog, organizationId)
    if (!snapshot || !Array.isArray(snapshot.products)) return null
    const products = snapshot.products.filter(isCatalogProduct)
    return products.length > 0 ? products : null
  } catch {
    return null
  }
}

export async function writeOfflinePaymentMethods (
  organizationId: string,
  paymentMethods: CachedPaymentMethod[],
) {
  if (!organizationId) return
  const snapshot: PdvOfflinePaymentMethodsSnapshot = {
    organizationId,
    updatedAt: new Date().toISOString(),
    paymentMethods,
  }
  try {
    await idbPut(STORES.paymentMethods, snapshot)
  } catch {
    // ignore
  }
}

export async function readOfflinePaymentMethods (
  organizationId: string,
): Promise<CachedPaymentMethod[] | null> {
  if (!organizationId) return null
  try {
    const snapshot = await idbGet<PdvOfflinePaymentMethodsSnapshot>(
      STORES.paymentMethods,
      organizationId,
    )
    if (!snapshot || !Array.isArray(snapshot.paymentMethods)) return null
    const methods = snapshot.paymentMethods.filter(isPaymentMethod)
    return methods.length > 0 ? methods : null
  } catch {
    return null
  }
}
