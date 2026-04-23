import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ResaleDeviceRow = {
  id: string
  device_model_id: string | null
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  imei2?: string | null
  serial?: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  expected_profit_wholesale_cents: number | null
  sale_value_cents: number | null
  expected_profit_sale_cents: number | null
  sold_for_cents: number | null
  advertised: boolean
  tested: boolean
  label: string | null
  stock_type?: string | null
  image_url?: string | null
  image_storage_path?: string | null
  /** Até 9 caminhos extras no Storage (capa: image_storage_path ou image_url). */
  image_gallery_paths?: string[] | null
  /** Preenchido no servidor (URL assinada ou externa) para listagens. */
  display_image_url?: string | null
  sold: boolean
  actual_profit_cents: number | null
  purchase_date: string | null
  sale_date: string | null
  created_at: string
  updated_at: string
  costs: Array<{ id: string; description: string | null; value_cents: number }>
}

export type SeminovosStats = {
  soldThisMonthCount: number
  soldThisMonthCents: number
  profitThisMonthCents: number
  soldLastMonthCount: number
  soldLastMonthCents: number
  profitLastMonthCents: number
}

export type SeminovosFilters = {
  q: string
  condition: string
  storageGb: string
  color: string
  purchaseDateFrom: string
  purchaseDateTo: string
  stockType: 'seminovo' | 'lacrado' | 'all'
  /** Quando true, inclui aparelhos vendidos na consulta (default: false). */
  includeSold?: boolean
  /** Filtro exato pelo nome do aparelho (device_name). */
  deviceName?: string
  /** Catálogo revenda: faixa sobre o menor preço cadastrado (varejo/atacado), em centavos. */
  valueMinCents?: number | null
  valueMaxCents?: number | null
}

export async function fetchSeminovosDevices(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: SeminovosFilters
): Promise<ResaleDeviceRow[]> {
  let query = supabase
    .from('resale_devices')
    .select(`
      id,
      device_model_id,
      device_name,
      model,
      color,
      storage_gb,
      battery,
      condition,
      info,
      imei,
      imei2,
      serial,
      purchase_value_cents,
      wholesale_value_cents,
      expected_profit_wholesale_cents,
      sale_value_cents,
      expected_profit_sale_cents,
      sold_for_cents,
      advertised,
      tested,
      label,
      stock_type,
      image_url,
      image_storage_path,
      image_gallery_paths,
      sold,
      actual_profit_cents,
      purchase_date,
      sale_date,
      created_at,
      updated_at
    `)

  const {
    q,
    condition,
    storageGb,
    color,
    purchaseDateFrom,
    purchaseDateTo,
    stockType,
    includeSold,
    deviceName,
    valueMinCents,
    valueMaxCents,
  } = filters

  if (!includeSold) {
    query = query.eq('sold', false)
  }

  if (stockType === 'all') {
    query = query.in('stock_type', ['seminovo', 'lacrado'])
  } else {
    query = query.eq('stock_type', stockType)
  }

  const deviceNameTrim = (deviceName || '').trim()
  if (deviceNameTrim) {
    query = query.eq('device_name', deviceNameTrim)
  }

  if (q) {
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `device_name.ilike.%${escaped}%,model.ilike.%${escaped}%,color.ilike.%${escaped}%,imei.ilike.%${escaped}%,info.ilike.%${escaped}%`
    )
  }
  if (condition) {
    query = query.eq('condition', condition)
  }
  if (storageGb) {
    query = query.ilike('storage_gb', `%${storageGb}%`)
  }
  if (color) {
    query = query.ilike('color', `%${color}%`)
  }
  if (purchaseDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDateFrom)) {
    query = query.gte('purchase_date', purchaseDateFrom)
  }
  if (purchaseDateTo && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDateTo)) {
    query = query.lte('purchase_date', purchaseDateTo)
  }

  const { data: devices, error } = await query.order('created_at', { ascending: false })

  if (error) return []

  const ids = (devices || []).map((d: { id: string }) => d.id)
  const costsMap: Record<string, { id: string; description: string | null; value_cents: number }[]> = {}
  if (ids.length > 0) {
    const { data: costs } = await supabase
      .from('resale_device_costs')
      .select('id, resale_device_id, description, value_cents')
      .in('resale_device_id', ids)
    for (const c of costs || []) {
      const rid = (c as { resale_device_id: string }).resale_device_id
      if (!costsMap[rid]) costsMap[rid] = []
      costsMap[rid].push({
        id: (c as { id: string }).id,
        description: (c as { description: string | null }).description ?? null,
        value_cents: (c as { value_cents: number }).value_cents ?? 0,
      })
    }
  }

  let list = (devices || []).map((d: Record<string, unknown>) => ({
    ...d,
    costs: costsMap[(d.id as string)] || [],
  })) as ResaleDeviceRow[]

  const hasMin = typeof valueMinCents === 'number' && valueMinCents > 0
  const hasMax = typeof valueMaxCents === 'number' && valueMaxCents > 0
  if (hasMin || hasMax) {
    let minBound = hasMin ? (valueMinCents as number) : 0
    let maxBound = hasMax ? (valueMaxCents as number) : Number.MAX_SAFE_INTEGER
    if (minBound > maxBound) {
      const t = minBound
      minBound = maxBound
      maxBound = t
    }
    list = list.filter((d) => {
      const s = d.sale_value_cents
      const w = d.wholesale_value_cents
      const nums = [s, w].filter((x): x is number => typeof x === 'number' && x > 0)
      if (nums.length === 0) return false
      const p = Math.min(...nums)
      return p >= minBound && p <= maxBound
    })
  }

  return list
}

/** Nomes distintos de aparelho (device_name) no estoque, para filtro. */
export async function fetchResaleDistinctDeviceNames (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  stockType: 'seminovo' | 'lacrado' | 'all',
): Promise<string[]> {
  let q = supabase
    .from('resale_devices')
    .select('device_name')
    .eq('sold', false)
    .not('device_name', 'is', null)

  if (stockType === 'all') {
    q = q.in('stock_type', ['seminovo', 'lacrado'])
  } else {
    q = q.eq('stock_type', stockType)
  }

  const { data, error } = await q
  if (error || !data) return []
  const set = new Set<string>()
  for (const row of data) {
    const n = String((row as { device_name?: string | null }).device_name || '').trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

export async function fetchSeminovosStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<SeminovosStats> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const thisMonthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(year, month + 1, 1)
  const thisMonthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const lastMonthDate = new Date(year, month - 1, 1)
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`
  const lastMonthEnd = thisMonthStart

  const [thisMonthRes, lastMonthRes] = await Promise.all([
    supabase
      .from('resale_devices')
      .select('sold_for_cents, actual_profit_cents')
      .eq('sold', true)
      .gte('sale_date', thisMonthStart)
      .lt('sale_date', thisMonthEnd),
    supabase
      .from('resale_devices')
      .select('sold_for_cents, actual_profit_cents')
      .eq('sold', true)
      .gte('sale_date', lastMonthStart)
      .lt('sale_date', lastMonthEnd),
  ])

  const thisList = thisMonthRes.error ? [] : (thisMonthRes.data || [])
  const lastList = lastMonthRes.error ? [] : (lastMonthRes.data || [])

  return {
    soldThisMonthCount: thisList.length,
    soldThisMonthCents: thisList.reduce((acc, d) => acc + (d.sold_for_cents ?? 0), 0),
    profitThisMonthCents: thisList.reduce((acc, d) => acc + (d.actual_profit_cents ?? 0), 0),
    soldLastMonthCount: lastList.length,
    soldLastMonthCents: lastList.reduce((acc, d) => acc + (d.sold_for_cents ?? 0), 0),
    profitLastMonthCents: lastList.reduce((acc, d) => acc + (d.actual_profit_cents ?? 0), 0),
  }
}
