import { idbDelete, idbGet, idbGetAll, idbPut, STORES } from './idb'
import type { PdvOfflineSale, PdvOfflineSalePayload } from './types'

function newId () {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pdv-offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function summaryTotalCents (payload: PdvOfflineSalePayload) {
  const items = payload.items.reduce((sum, item) => (
    sum + Math.max(0, item.unit_price_cents) * Math.max(0, item.quantity) - Math.max(0, item.discount_cents)
  ), 0)
  return Math.max(0, items - Math.max(0, payload.discount_total_cents) + Math.max(0, payload.surcharge_cents))
}

export async function enqueueOfflineSale (input: {
  organizationId: string
  payload: PdvOfflineSalePayload
}): Promise<PdvOfflineSale> {
  const sale: PdvOfflineSale = {
    id: newId(),
    organizationId: input.organizationId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attemptCount: 0,
    lastError: null,
    lastAttemptAt: null,
    syncedOrderId: null,
    syncedOrderNumber: null,
    payload: input.payload,
    summary: {
      itemCount: input.payload.items.reduce((n, item) => n + Math.max(0, item.quantity), 0),
      totalCents: summaryTotalCents(input.payload),
      customerName: String(input.payload.customer_name || 'Consumidor Final').trim() || 'Consumidor Final',
    },
  }
  await idbPut(STORES.salesQueue, sale)
  return sale
}

export async function listOfflineSales (organizationId: string): Promise<PdvOfflineSale[]> {
  if (!organizationId) return []
  try {
    const all = await idbGetAll<PdvOfflineSale>(STORES.salesQueue)
    return all
      .filter((row) => row.organizationId === organizationId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  } catch {
    return []
  }
}

export async function listActionableOfflineSales (organizationId: string) {
  const rows = await listOfflineSales(organizationId)
  return rows.filter((row) => row.status === 'pending' || row.status === 'failed' || row.status === 'syncing')
}

export async function countPendingOfflineSales (organizationId: string) {
  const rows = await listActionableOfflineSales(organizationId)
  return rows.filter((row) => row.status === 'pending' || row.status === 'failed').length
}

export async function updateOfflineSale (sale: PdvOfflineSale) {
  await idbPut(STORES.salesQueue, sale)
}

export async function getOfflineSale (id: string) {
  return idbGet<PdvOfflineSale>(STORES.salesQueue, id)
}

export async function removeSyncedOfflineSales (organizationId: string, olderThanMs = 1000 * 60 * 60 * 24) {
  const rows = await listOfflineSales(organizationId)
  const cutoff = Date.now() - olderThanMs
  await Promise.all(
    rows
      .filter((row) => row.status === 'synced' && new Date(row.createdAt).getTime() < cutoff)
      .map((row) => idbDelete(STORES.salesQueue, row.id)),
  )
}

export function isLikelyNetworkFailure (err: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (err instanceof TypeError) return true
  const message = err instanceof Error ? err.message : String(err || '')
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}
