import {
  idbGet,
  idbGetAllFromIndex,
  idbPut,
  idbReplaceOrgCatalogProducts,
  STORES,
} from './idb'
import type {
  PdvOfflineCatalogMeta,
  PdvOfflineCatalogProduct,
  PdvOfflinePaymentMethodsSnapshot,
} from './types'

type CachedPaymentMethod = {
  id: string
  description: string
  type: string
  credit_installment_fees?: unknown
}

function isCatalogProduct (row: unknown): row is PdvOfflineCatalogProduct {
  if (!row || typeof row !== 'object') return false
  const r = row as PdvOfflineCatalogProduct
  return typeof r.id === 'string' && typeof r.name === 'string'
}

function isPaymentMethod (row: unknown): row is CachedPaymentMethod {
  if (!row || typeof row !== 'object') return false
  const r = row as CachedPaymentMethod
  return typeof r.id === 'string' && typeof r.description === 'string' && typeof r.type === 'string'
}

export async function writeOfflineCatalog (
  organizationId: string,
  products: PdvOfflineCatalogProduct[],
  options?: { truncated?: boolean, updatedAt?: string | null },
) {
  if (!organizationId) return
  const normalized = products.filter(isCatalogProduct).map((product) => ({
    ...product,
    id: product.id,
    organizationId,
  }))
  const updatedAt = String(options?.updatedAt || '').trim() || new Date().toISOString()
  try {
    await idbReplaceOrgCatalogProducts(organizationId, normalized, {
      updatedAt,
      truncated: Boolean(options?.truncated),
      schemaVersion: 2,
    })
    // Mantém blob legado em sync para leitores antigos na mesma aba até reload completo.
    await idbPut(STORES.catalog, {
      organizationId,
      updatedAt,
      products: normalized,
      truncated: Boolean(options?.truncated),
      schemaVersion: 2,
    })
  } catch {
    // Quota / private mode — ignora.
  }
}

export async function readOfflineCatalog (
  organizationId: string,
): Promise<PdvOfflineCatalogProduct[] | null> {
  if (!organizationId) return null
  try {
    const products = await idbGetAllFromIndex<PdvOfflineCatalogProduct>(
      STORES.catalogProducts,
      'by_org',
      organizationId,
    )
    const filtered = products.filter(isCatalogProduct)
    if (filtered.length > 0) return filtered

    // Fallback blob v1
    const snapshot = await idbGet<{ products?: unknown[] }>(STORES.catalog, organizationId)
    if (!snapshot || !Array.isArray(snapshot.products)) return null
    const legacy = snapshot.products.filter(isCatalogProduct)
    return legacy.length > 0 ? legacy : null
  } catch {
    return null
  }
}

export async function readOfflineCatalogMeta (
  organizationId: string,
): Promise<PdvOfflineCatalogMeta | null> {
  if (!organizationId) return null
  try {
    return await idbGet<PdvOfflineCatalogMeta>(STORES.catalogMeta, organizationId)
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
    schemaVersion: 2,
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
