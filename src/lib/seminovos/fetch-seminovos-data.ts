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
  stockType: 'seminovo' | 'lacrado'
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
      sold,
      actual_profit_cents,
      purchase_date,
      sale_date,
      created_at,
      updated_at
    `)
    .eq('sold', false)

  const { q, condition, storageGb, color, purchaseDateFrom, purchaseDateTo, stockType } = filters

  query = query.eq('stock_type', stockType)

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

  return (devices || []).map((d: Record<string, unknown>) => ({
    ...d,
    costs: costsMap[(d.id as string)] || [],
  })) as ResaleDeviceRow[]
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
