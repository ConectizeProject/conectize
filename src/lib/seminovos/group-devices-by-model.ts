/**
 * Mesma ordenação da listagem de seminovos: agrupa por nome do modelo,
 * ordena grupos (modelo mais “novo” primeiro) e dentro do grupo por GB.
 */

export function getModelSortKey (deviceName: string | null): number {
  if (!deviceName || !deviceName.trim()) return 0
  const name = deviceName.trim()
  const numMatch = name.match(/(\d+)/)
  const num = numMatch ? Number.parseInt(numMatch[1], 10) : 0
  let variant = 1
  if (/\bpro\s+max\b/i.test(name)) variant = 3
  else if (/\bpro\b/i.test(name)) variant = 2
  return num * 10 + variant
}

export function parseStorageGb (storage: string | null): number {
  if (!storage || !storage.trim()) return 0
  const num = Number.parseInt(String(storage).replace(/\D/g, ''), 10)
  return Number.isNaN(num) ? 0 : num
}

export function groupDevicesByModel<T extends { device_name: string | null; storage_gb: string | null }> (
  list: T[],
): Array<{ modelKey: string; devices: T[] }> {
  const byModel = new Map<string, T[]>()
  for (const d of list) {
    const key = (d.device_name || '').trim() || 'Outros'
    if (!byModel.has(key)) byModel.set(key, [])
    byModel.get(key)!.push(d)
  }
  for (const arr of byModel.values()) {
    arr.sort((a, b) => {
      const storageA = parseStorageGb(a.storage_gb)
      const storageB = parseStorageGb(b.storage_gb)
      if (storageA !== storageB) return storageB - storageA
      return (a.device_name || '').localeCompare(b.device_name || '')
    })
  }
  const groups = Array.from(byModel.entries()).map(([modelKey, devices]) => ({ modelKey, devices }))
  groups.sort((a, b) => {
    const keyA = getModelSortKey(a.modelKey)
    const keyB = getModelSortKey(b.modelKey)
    if (keyA !== keyB) return keyB - keyA
    const maxStorageA = Math.max(...a.devices.map((d) => parseStorageGb(d.storage_gb)))
    const maxStorageB = Math.max(...b.devices.map((d) => parseStorageGb(d.storage_gb)))
    if (maxStorageA !== maxStorageB) return maxStorageB - maxStorageA
    return a.modelKey.localeCompare(b.modelKey)
  })
  return groups
}
