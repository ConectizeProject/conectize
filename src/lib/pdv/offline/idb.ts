const DB_NAME = 'conectize-pdv-offline'
const DB_VERSION = 1

export const STORES = {
  catalog: 'catalog',
  paymentMethods: 'payment_methods',
  salesQueue: 'sales_queue',
} as const

type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb (): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null
      reject(new Error('indexeddb_unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
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

function requestToPromise<T> (request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexeddb_request_failed'))
  })
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

export async function idbGet<T> (storeName: StoreName, key: string): Promise<T | null> {
  return withStore(storeName, 'readonly', (store) => store.get(key) as IDBRequest<T | undefined>)
    .then((result) => result ?? null)
}

export async function idbDelete (storeName: StoreName, key: string) {
  await withStore(storeName, 'readwrite', (store) => store.delete(key))
}

export async function idbGetAll<T> (storeName: StoreName): Promise<T[]> {
  const result = await withStore(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)
  return Array.isArray(result) ? result : []
}

/** Útil para depurar no console: `await window.__pdvOfflineDebug()` */
export async function debugOfflineDb () {
  const db = await openDb()
  const catalog = await idbGetAll(STORES.catalog)
  const paymentMethods = await idbGetAll(STORES.paymentMethods)
  const salesQueue = await idbGetAll(STORES.salesQueue)
  return {
    dbName: DB_NAME,
    version: db.version,
    stores: [...db.objectStoreNames],
    catalog,
    paymentMethods,
    salesQueue,
  }
}
