/**
 * IndexedDB do PDV offline.
 *
 * Source of truth offline = este módulo (fila de vendas, catálogo, payment methods).
 * Cache de UX (session/localStorage com TTL) = `@/lib/portal/browser-cache`.
 */
const DB_NAME = 'conectize-pdv-offline'
/** v2: catalog_products + catalog_meta (catálogo por produto) + migração do blob v1. */
export const DB_VERSION = 2

export const STORES = {
  catalog: 'catalog',
  catalogProducts: 'catalog_products',
  catalogMeta: 'catalog_meta',
  paymentMethods: 'payment_methods',
  salesQueue: 'sales_queue',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function migrateV1ToV2 (db: IDBDatabase, tx: IDBTransaction) {
  if (!db.objectStoreNames.contains(STORES.catalogProducts)) {
    const products = db.createObjectStore(STORES.catalogProducts, { keyPath: 'id' })
    products.createIndex('by_org', 'organizationId', { unique: false })
    products.createIndex('by_org_barcode', ['organizationId', 'barcode'], { unique: false })
    products.createIndex('by_org_sku', ['organizationId', 'sku'], { unique: false })
  }
  if (!db.objectStoreNames.contains(STORES.catalogMeta)) {
    db.createObjectStore(STORES.catalogMeta, { keyPath: 'organizationId' })
  }

  // Migra blob legado `catalog` → products + meta (best-effort).
  if (!db.objectStoreNames.contains(STORES.catalog)) return
  const legacyStore = tx.objectStore(STORES.catalog)
  const productsStore = tx.objectStore(STORES.catalogProducts)
  const metaStore = tx.objectStore(STORES.catalogMeta)

  const request = legacyStore.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    const snap = cursor.value as {
      organizationId?: string
      updatedAt?: string
      products?: unknown[]
      truncated?: boolean
    }
    const organizationId = String(snap?.organizationId || '')
    if (organizationId && Array.isArray(snap.products)) {
      metaStore.put({
        organizationId,
        updatedAt: String(snap.updatedAt || new Date().toISOString()),
        truncated: Boolean(snap.truncated),
        schemaVersion: 2,
        productCount: snap.products.length,
      })
      for (const row of snap.products) {
        if (!row || typeof row !== 'object') continue
        const product = row as { id?: unknown }
        const id = String(product.id || '')
        if (!id) continue
        productsStore.put({
          ...product,
          id,
          organizationId,
        })
      }
    }
    cursor.continue()
  }
}

function openDb (): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null
      reject(new Error('indexeddb_unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const tx = request.transaction
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORES.catalog)) {
          db.createObjectStore(STORES.catalog, { keyPath: 'organizationId' })
        }
        if (!db.objectStoreNames.contains(STORES.paymentMethods)) {
          db.createObjectStore(STORES.paymentMethods, { keyPath: 'organizationId' })
        }
        if (!db.objectStoreNames.contains(STORES.salesQueue)) {
          const store = db.createObjectStore(STORES.salesQueue, { keyPath: 'id' })
          store.createIndex('by_org_created', ['organizationId', 'createdAt'], { unique: false })
        }
      }

      if (oldVersion < 2 && tx) {
        migrateV1ToV2(db, tx)
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('indexeddb_open_failed'))
    }

    request.onblocked = () => {
      dbPromise = null
      reject(new Error('indexeddb_blocked'))
    }
  })

  return dbPromise
}

async function withStore<T> (
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb()

  return new Promise((resolve, reject) => {
    let settled = false
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)

    tx.oncomplete = () => {
      if (!settled) {
        settled = true
        resolve(undefined as T)
      }
    }
    tx.onabort = () => {
      if (!settled) {
        settled = true
        reject(tx.error ?? new Error('indexeddb_tx_aborted'))
      }
    }
    tx.onerror = () => {
      if (!settled) {
        settled = true
        reject(tx.error ?? new Error('indexeddb_tx_failed'))
      }
    }

    try {
      const request = run(store)
      if (request) {
        request.onsuccess = () => {
          if (!settled) {
            settled = true
            resolve(request.result)
          }
        }
        request.onerror = () => {
          if (!settled) {
            settled = true
            reject(request.error ?? new Error('indexeddb_request_failed'))
          }
        }
      }
    } catch (err) {
      settled = true
      reject(err)
    }
  })
}

export async function idbPut<T extends object> (storeName: StoreName, value: T) {
  await withStore(storeName, 'readwrite', (store) => store.put(value))
}

export async function idbGet<T> (storeName: StoreName, key: IDBValidKey): Promise<T | null> {
  return withStore(storeName, 'readonly', (store) => store.get(key) as IDBRequest<T | undefined>)
    .then((result) => result ?? null)
}

export async function idbDelete (storeName: StoreName, key: IDBValidKey) {
  await withStore(storeName, 'readwrite', (store) => store.delete(key))
}

export async function idbGetAll<T> (storeName: StoreName): Promise<T[]> {
  const result = await withStore(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)
  return Array.isArray(result) ? result : []
}

export async function idbGetAllFromIndex<T> (
  storeName: StoreName,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const request = query === undefined ? index.getAll() : index.getAll(query)
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
    request.onerror = () => reject(request.error ?? new Error('indexeddb_index_getall_failed'))
  })
}

export async function idbClearStore (storeName: StoreName) {
  await withStore(storeName, 'readwrite', (store) => store.clear())
}

export async function idbReplaceOrgCatalogProducts (
  organizationId: string,
  products: Array<Record<string, unknown> & { id: string }>,
  meta: {
    updatedAt: string
    truncated?: boolean
    schemaVersion?: number
  },
) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.catalogProducts, STORES.catalogMeta], 'readwrite')
    const productsStore = tx.objectStore(STORES.catalogProducts)
    const metaStore = tx.objectStore(STORES.catalogMeta)
    const byOrg = productsStore.index('by_org')

    const clearReq = byOrg.openKeyCursor(IDBKeyRange.only(organizationId))
    clearReq.onsuccess = () => {
      const cursor = clearReq.result
      if (!cursor) {
        for (const product of products) {
          productsStore.put({ ...product, organizationId, id: product.id })
        }
        metaStore.put({
          organizationId,
          updatedAt: meta.updatedAt,
          truncated: Boolean(meta.truncated),
          schemaVersion: meta.schemaVersion ?? 2,
          productCount: products.length,
        })
        return
      }
      productsStore.delete(cursor.primaryKey)
      cursor.continue()
    }
    clearReq.onerror = () => reject(clearReq.error ?? new Error('indexeddb_clear_org_failed'))

    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb_tx_aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_tx_failed'))
  })
}

/** Útil para depurar no console (somente em desenvolvimento). */
export async function debugOfflineDb () {
  const db = await openDb()
  const catalog = await idbGetAll(STORES.catalog)
  const catalogProducts = await idbGetAll(STORES.catalogProducts)
  const catalogMeta = await idbGetAll(STORES.catalogMeta)
  const paymentMethods = await idbGetAll(STORES.paymentMethods)
  const salesQueue = await idbGetAll(STORES.salesQueue)
  return {
    dbName: DB_NAME,
    version: db.version,
    stores: [...db.objectStoreNames],
    catalog,
    catalogProducts,
    catalogMeta,
    paymentMethods,
    salesQueue,
  }
}

export async function clearAllOfflineData () {
  try {
    await Promise.all([
      idbClearStore(STORES.catalog),
      idbClearStore(STORES.catalogProducts),
      idbClearStore(STORES.catalogMeta),
      idbClearStore(STORES.paymentMethods),
      idbClearStore(STORES.salesQueue),
    ])
  } catch {
    // ignore
  }
}

/** Limpa IndexedDB + caches de UX (session/local) no logout. */
export async function clearOfflineClientState () {
  await clearAllOfflineData()
  try {
    const { clearBrowserCacheNamespace } = await import('@/lib/portal/browser-cache')
    for (const namespace of [
      'pdv:catalog-snapshot',
      'pdv:top-products',
      'portal:device-models',
      'os:service-suggestions',
    ]) {
      clearBrowserCacheNamespace(namespace)
    }
  } catch {
    // ignore
  }
}

export async function requestPersistentStorage () {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
