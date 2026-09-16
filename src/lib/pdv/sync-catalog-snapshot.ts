'use client'

import {
  readSessionCatalogSnapshot,
  writeSessionCatalogSnapshot,
} from '@/app/(portal)/portal/pdv/pdv-catalog-cache'
import { mapCatalogProduct } from '@/app/(portal)/portal/pdv/pdv-helpers'
import type { CatalogProduct } from '@/app/(portal)/portal/pdv/pdv-types'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  readOfflineCatalog,
  readOfflineCatalogMeta,
  writeOfflineCatalog,
} from '@/lib/pdv/offline/catalog-store'

export type SyncCatalogResult =
  | {
      ok: true
      products: CatalogProduct[]
      count: number
      source: 'network' | 'cache' | 'offline'
      truncated?: boolean
    }
  | {
      ok: false
      products: CatalogProduct[]
      count: number
      error: 'no_org' | 'offline_empty' | 'sync_failed' | 'aborted'
      truncated?: boolean
    }

function asCatalogProducts (rows: unknown[]): CatalogProduct[] {
  return rows.filter((row): row is CatalogProduct => (
    Boolean(row)
    && typeof row === 'object'
    && typeof (row as CatalogProduct).id === 'string'
    && typeof (row as CatalogProduct).name === 'string'
  ))
}

/** Hidrata o snapshot da sessão (ou IndexedDB) sem rede. */
export async function hydrateCatalogSnapshot (
  organizationId: string | null | undefined,
): Promise<CatalogProduct[]> {
  if (!organizationId) return []

  const sessionProducts = readSessionCatalogSnapshot(organizationId)
  if (sessionProducts?.length) return sessionProducts

  const offlineProducts = await readOfflineCatalog(organizationId)
  if (!offlineProducts?.length) return []

  const products = asCatalogProducts(offlineProducts)
  if (products.length > 0) {
    writeSessionCatalogSnapshot(organizationId, products)
  }
  return products
}

type SyncOptions = {
  force?: boolean
  signal?: AbortSignal
  /** Chamado ao hidratar cache e após sync de rede (para UI progressiva). */
  onProducts?: (products: CatalogProduct[]) => void
}

/**
 * Sincroniza o catálogo PDV (sessionStorage + IndexedDB).
 * Sem `force`, hidrata cache local antes de buscar na rede.
 * Usa ETag/`since` para evitar baixar o snapshot inteiro quando nada mudou.
 */
export async function syncCatalogSnapshot (
  organizationId: string | null | undefined,
  options?: SyncOptions,
): Promise<SyncCatalogResult> {
  if (!organizationId) {
    return { ok: false, products: [], count: 0, error: 'no_org' }
  }

  const force = Boolean(options?.force)
  const signal = options?.signal
  const onProducts = options?.onProducts

  if (!force) {
    const hydrated = await hydrateCatalogSnapshot(organizationId)
    if (hydrated.length > 0) onProducts?.(hydrated)
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineProducts = await readOfflineCatalog(organizationId)
    if (offlineProducts?.length) {
      const products = asCatalogProducts(offlineProducts)
      writeSessionCatalogSnapshot(organizationId, products)
      onProducts?.(products)
      return { ok: true, products, count: products.length, source: 'offline' }
    }
    return { ok: false, products: [], count: 0, error: 'offline_empty' }
  }

  try {
    const meta = force ? null : await readOfflineCatalogMeta(organizationId)
    const clientTag = String(meta?.updatedAt || '').trim()
    const headers: Record<string, string> = {}
    if (clientTag) headers['If-None-Match'] = `"${clientTag}"`
    const url = clientTag
      ? `/api/portal/pdv/catalog?snapshot=1&since=${encodeURIComponent(clientTag)}`
      : '/api/portal/pdv/catalog?snapshot=1'

    const res = await portalFetch(url, { signal, headers })
    if (signal?.aborted) {
      return { ok: false, products: [], count: 0, error: 'aborted' }
    }
    const data = await res?.json().catch(() => null) as {
      ok?: boolean
      not_modified?: boolean
      products?: unknown[]
      truncated?: boolean
      updated_at?: string | null
      etag?: string | null
    } | null
    if (signal?.aborted) {
      return { ok: false, products: [], count: 0, error: 'aborted' }
    }

    if (data?.ok && data.not_modified) {
      const offlineProducts = await readOfflineCatalog(organizationId)
      if (offlineProducts?.length) {
        const products = asCatalogProducts(offlineProducts)
        writeSessionCatalogSnapshot(organizationId, products)
        onProducts?.(products)
        return {
          ok: true,
          products,
          count: products.length,
          source: 'cache',
          truncated: Boolean(meta?.truncated),
        }
      }
      // Meta stale / IDB vazio — baixa snapshot completo sem since.
      const fullRes = await portalFetch('/api/portal/pdv/catalog?snapshot=1', { signal })
      const fullData = await fullRes?.json().catch(() => null) as {
        ok?: boolean
        products?: unknown[]
        truncated?: boolean
        updated_at?: string | null
        etag?: string | null
      } | null
      if (!fullData?.ok || !Array.isArray(fullData.products)) {
        return { ok: false, products: [], count: 0, error: 'sync_failed' }
      }
      const products = fullData.products.map((row: Record<string, unknown>) =>
        mapCatalogProduct(row),
      )
      const truncated = Boolean(fullData.truncated)
      const updatedAt = String(fullData.etag || fullData.updated_at || '').trim() || null
      writeSessionCatalogSnapshot(organizationId, products)
      try {
        await writeOfflineCatalog(organizationId, products, { truncated, updatedAt })
      } catch (err) {
        console.warn('[pdv-offline] falha ao gravar catálogo no IndexedDB', err)
      }
      onProducts?.(products)
      return { ok: true, products, count: products.length, source: 'network', truncated }
    }

    if (!data?.ok || !Array.isArray(data.products)) {
      return { ok: false, products: [], count: 0, error: 'sync_failed' }
    }

    const products = data.products.map((row: Record<string, unknown>) =>
      mapCatalogProduct(row),
    )
    const truncated = Boolean(data.truncated)
    const updatedAt = String(data.etag || data.updated_at || '').trim() || null
    writeSessionCatalogSnapshot(organizationId, products)
    try {
      await writeOfflineCatalog(organizationId, products, { truncated, updatedAt })
    } catch (err) {
      console.warn('[pdv-offline] falha ao gravar catálogo no IndexedDB', err)
    }
    onProducts?.(products)
    return { ok: true, products, count: products.length, source: 'network', truncated }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, products: [], count: 0, error: 'aborted' }
    }
    const offlineProducts = await readOfflineCatalog(organizationId)
    if (offlineProducts?.length) {
      const products = asCatalogProducts(offlineProducts)
      writeSessionCatalogSnapshot(organizationId, products)
      onProducts?.(products)
      return { ok: true, products, count: products.length, source: 'cache' }
    }
    return { ok: false, products: [], count: 0, error: 'sync_failed' }
  }
}
