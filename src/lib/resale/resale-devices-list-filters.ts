export type ResaleDevicesListFilterParams = {
  soldFilter: boolean
  q: string
  condition: string
  storageGb: string
  color: string
  purchaseDateFrom: string
  purchaseDateTo: string
  stockType: string
  deviceName: string
}

const DEVICE_SELECT = `
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
  sold,
  actual_profit_cents,
  purchase_date,
  sale_date,
  payment_method_id,
  payment_installments,
  sale_payment_methods,
  buyer_name,
  buyer_cpf,
  sale_details,
  stock_type,
  sale_commission_user_id,
  image_url,
  image_storage_path,
  image_gallery_paths,
  created_at,
  updated_at
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any

export function applyResaleDevicesListFilters (
  query: QueryBuilder,
  filters: ResaleDevicesListFilterParams,
): QueryBuilder {
  let q = query

  if (filters.soldFilter === true) {
    q = q.eq('sold', true)
  } else if (filters.soldFilter === false) {
    q = q.eq('sold', false)
  }

  if (filters.q) {
    const escaped = filters.q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    q = q.or(
      `device_name.ilike.%${escaped}%,model.ilike.%${escaped}%,color.ilike.%${escaped}%,imei.ilike.%${escaped}%,info.ilike.%${escaped}%`,
    )
  }
  if (filters.condition) {
    q = q.eq('condition', filters.condition)
  }
  if (filters.storageGb) {
    q = q.ilike('storage_gb', `%${filters.storageGb}%`)
  }
  if (filters.color) {
    q = q.ilike('color', `%${filters.color}%`)
  }
  if (filters.purchaseDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(filters.purchaseDateFrom)) {
    q = q.gte('purchase_date', filters.purchaseDateFrom)
  }
  if (filters.purchaseDateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.purchaseDateTo)) {
    q = q.lte('purchase_date', filters.purchaseDateTo)
  }
  if (filters.stockType === 'all') {
    q = q.in('stock_type', ['seminovo', 'lacrado'])
  } else if (filters.stockType === 'seminovo' || filters.stockType === 'lacrado') {
    q = q.eq('stock_type', filters.stockType)
  }
  if (filters.deviceName) {
    q = q.eq('device_name', filters.deviceName)
  }

  return q
}

export function resaleDevicesListOrder (
  query: QueryBuilder,
  soldFilter: boolean,
): QueryBuilder {
  if (soldFilter === true) {
    return query.order('sale_date', { ascending: false, nullsFirst: false })
  }
  return query.order('created_at', { ascending: false })
}

export { DEVICE_SELECT }

export function parseResaleDevicesPagination (
  limitRaw: string | null,
  offsetRaw: string | null,
): { limit: number | null; offset: number } {
  if (limitRaw == null || limitRaw === '') {
    return { limit: null, offset: 0 }
  }
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw, 10) || 20))
  const offset = Math.max(0, Number.parseInt(offsetRaw || '0', 10) || 0)
  return { limit, offset }
}
