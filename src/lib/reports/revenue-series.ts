export type RevenueInput = {
  dateISO: string | null | undefined
  grossCents: number | null | undefined
  netCents: number | null | undefined
}

export type RevenueBucket = {
  key: string
  label: string
  grossCents: number
  netCents: number
  count: number
}

type Period = 'day' | 'week' | 'month'

export function buildRevenueSeries (items: RevenueInput[]) {
  const validItems = items
    .map((item) => normalizeItem(item))
    .filter((item): item is NormalizedItem => Boolean(item))

  return {
    daily: bucketByPeriod(validItems, 'day'),
    weekly: bucketByPeriod(validItems, 'week'),
    monthly: bucketByPeriod(validItems, 'month'),
  }
}

type NormalizedItem = {
  date: Date
  grossCents: number
  netCents: number
}

function normalizeItem (item: RevenueInput): NormalizedItem | null {
  if (!item.dateISO) return null
  const date = new Date(String(item.dateISO))
  if (Number.isNaN(date.getTime())) return null

  const gross = Number.isFinite(Number(item.grossCents)) ? Number(item.grossCents) : 0
  const net = Number.isFinite(Number(item.netCents)) ? Number(item.netCents) : 0

  return {
    date,
    grossCents: gross,
    netCents: net,
  }
}

function bucketByPeriod (items: NormalizedItem[], period: Period): RevenueBucket[] {
  const map = new Map<string, RevenueBucket>()

  for (const item of items) {
    const key = buildKey(item.date, period)
    const label = buildLabel(item.date, period)

    const existing = map.get(key)
    if (existing) {
      existing.grossCents += item.grossCents
      existing.netCents += item.netCents
      existing.count += 1
    } else {
      map.set(key, {
        key,
        label,
        grossCents: item.grossCents,
        netCents: item.netCents,
        count: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function buildKey (date: Date, period: Period): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  if (period === 'day') {
    return `${year}-${month}-${day}`
  }

  if (period === 'month') {
    return `${year}-${month}`
  }

  const { isoWeekYear, isoWeek } = getIsoWeek(date)
  return `${isoWeekYear}-W${String(isoWeek).padStart(2, '0')}`
}

function buildLabel (date: Date, period: Period): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())

  if (period === 'day') {
    return `${day}/${month}`
  }

  if (period === 'month') {
    return `${month}/${year}`
  }

  const { isoWeek } = getIsoWeek(date)
  return `Sem ${isoWeek}`
}

function getIsoWeek (date: Date) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)

  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const diffDays = Math.floor((tmp.getTime() - yearStart.getTime()) / 86400000)
  const isoWeek = Math.floor(diffDays / 7) + 1

  return {
    isoWeekYear: tmp.getUTCFullYear(),
    isoWeek,
  }
}

