import type { ResaleDeviceRow } from '@/lib/seminovos/fetch-seminovos-data'
import { getModelSortKey, parseStorageGb } from '@/lib/seminovos/group-devices-by-model'

export type ResaleReferencePricingRow = {
  key: string
  deviceName: string
  condition: string | null
  storageGb: string | null
  minPurchaseCents: number
  wholesaleValueCents: number | null
  saleValueCents: number | null
  referenceDeviceId: string
}

function groupKey (d: ResaleDeviceRow): string {
  const name = (d.device_name || '').trim() || '—'
  const cond = (d.condition || '').trim() || '—'
  const gb = (d.storage_gb || '').trim() || '—'
  return `${name}\t${cond}\t${gb}`
}

function getConditionOrder (condition: string | null): number {
  const normalized = String(condition || '').trim().toUpperCase()
  if (normalized === 'A+') return 0
  if (normalized === 'A') return 1
  if (normalized === 'A-') return 2
  if (normalized === 'B+') return 3
  if (normalized === 'B') return 4
  if (normalized === 'B-') return 5
  return 999
}

/**
 * Menor valor de compra por (device_name, condition, storage_gb);
 * preços de venda/atacado da unidade escolhida (menor compra; empate: mais recente).
 */
export function aggregateResaleReferencePricing (
  devices: ResaleDeviceRow[],
): ResaleReferencePricingRow[] {
  type Best = {
    minPurchase: number
    row: ResaleDeviceRow
  }
  const map = new Map<string, Best>()

  for (const d of devices) {
    const purchase = d.purchase_value_cents
    if (purchase == null || purchase <= 0) continue
    const key = groupKey(d)
    const cur = map.get(key)
    if (!cur) {
      map.set(key, { minPurchase: purchase, row: d })
      continue
    }
    if (purchase < cur.minPurchase) {
      map.set(key, { minPurchase: purchase, row: d })
      continue
    }
    if (purchase === cur.minPurchase) {
      const tNew = new Date(d.created_at || 0).getTime()
      const tOld = new Date(cur.row.created_at || 0).getTime()
      if (tNew >= tOld) map.set(key, { minPurchase: purchase, row: d })
    }
  }

  const rows: ResaleReferencePricingRow[] = []
  for (const [key, { minPurchase, row }] of map) {
    rows.push({
      key,
      deviceName: (row.device_name || '').trim(),
      condition: row.condition ? String(row.condition).trim() : null,
      storageGb: row.storage_gb ? String(row.storage_gb).trim() : null,
      minPurchaseCents: minPurchase,
      wholesaleValueCents: row.wholesale_value_cents,
      saleValueCents: row.sale_value_cents,
      referenceDeviceId: row.id,
    })
  }

  rows.sort((a, b) => {
    const modelKeyA = getModelSortKey(a.deviceName)
    const modelKeyB = getModelSortKey(b.deviceName)
    if (modelKeyA !== modelKeyB) return modelKeyB - modelKeyA

    const c = a.deviceName.localeCompare(b.deviceName, 'pt-BR', { sensitivity: 'base' })
    if (c !== 0) return c

    const conditionA = getConditionOrder(a.condition)
    const conditionB = getConditionOrder(b.condition)
    if (conditionA !== conditionB) return conditionA - conditionB

    const storageA = parseStorageGb(a.storageGb)
    const storageB = parseStorageGb(b.storageGb)
    if (storageA !== storageB) return storageB - storageA

    return String(a.condition || '').localeCompare(String(b.condition || ''))
  })
  return rows
}
