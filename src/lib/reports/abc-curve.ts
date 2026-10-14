export type AbcClassName = 'A' | 'B' | 'C'

export type AbcItemInput = {
  id: string
  name: string
  sku: string | null
  revenueCents: number
}

export type AbcClassifiedItem = AbcItemInput & {
  sharePercent: number
}

export type AbcClassSlice = {
  className: AbcClassName
  revenueCents: number
  percent: number
  skuCount: number
  items: AbcClassifiedItem[]
}

const CLASS_ORDER: AbcClassName[] = ['A', 'B', 'C']

function classForItem (currentRatio: number, nextRatio: number, isFirst: boolean): AbcClassName {
  if (isFirst || (currentRatio < 0.8 && nextRatio <= 0.8)) return 'A'
  if (currentRatio < 0.95) return 'B'
  return 'C'
}

function integerPercents (parts: number[], total: number): number[] {
  if (total <= 0) return parts.map(() => 0)
  const raw = parts.map((part) => (part / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
  const percents = [...floors]
  for (const entry of order) {
    if (remaining <= 0) break
    percents[entry.index] += 1
    remaining -= 1
  }
  return percents
}

export function classifyAbc (items: AbcItemInput[]): AbcClassSlice[] {
  const ranked = items
    .filter((item) => item.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, 'pt-BR'))
  const total = ranked.reduce((sum, item) => sum + item.revenueCents, 0)
  const buckets: Record<AbcClassName, AbcClassifiedItem[]> = { A: [], B: [], C: [] }
  let cumulative = 0

  for (const item of ranked) {
    const next = cumulative + item.revenueCents
    const className = classForItem(total === 0 ? 0 : cumulative / total, total === 0 ? 0 : next / total, cumulative === 0)
    buckets[className].push({
      ...item,
      sharePercent: total === 0 ? 0 : (item.revenueCents / total) * 100,
    })
    cumulative = next
  }

  const revenues = CLASS_ORDER.map((className) => (
    buckets[className].reduce((sum, item) => sum + item.revenueCents, 0)
  ))
  const percents = integerPercents(revenues, total)

  return CLASS_ORDER.map((className, index) => ({
    className,
    revenueCents: revenues[index] ?? 0,
    percent: percents[index] ?? 0,
    skuCount: buckets[className].length,
    items: buckets[className],
  }))
}

export type AbcSkuRow = {
  id: string
  name: string
  sku: string | null
  parentId: string | null
  parentName: string | null
  parentSku: string | null
  revenueCents: number
}

export function abcItemsForMode (rows: AbcSkuRow[], mode: 'sku' | 'product'): AbcItemInput[] {
  if (mode === 'sku') {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      revenueCents: row.revenueCents,
    }))
  }

  const grouped = new Map<string, AbcItemInput>()
  for (const row of rows) {
    const id = row.parentId || row.id
    const current = grouped.get(id)
    if (current) {
      current.revenueCents += row.revenueCents
      continue
    }
    grouped.set(id, {
      id,
      name: row.parentId ? (row.parentName || row.name) : row.name,
      sku: row.parentId ? row.parentSku : row.sku,
      revenueCents: row.revenueCents,
    })
  }
  return Array.from(grouped.values())
}
