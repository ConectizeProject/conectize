import type { SupabaseClient } from '@supabase/supabase-js'

export type DeviceModelForSelector = {
  id: string
  brand: string
  device_type: string
  model: string
}

const DEFAULT_LIMIT = 1000

/**
 * Busca device models no servidor (para uso em Server Components).
 * Retorna no formato esperado pelo OrderDeviceSelector.
 */
export async function fetchDeviceModelsForSelector(
  supabase: SupabaseClient,
  limit = DEFAULT_LIMIT
): Promise<DeviceModelForSelector[]> {
  const { data, error } = await supabase
    .from('device_models')
    .select('id, model, device_type_id, device_types ( id, name, device_brands ( id, name ) )')
    .order('model', { ascending: true })
    .limit(Math.min(Math.max(1, limit), 2000))

  if (error) return []

  type BrandRow = { name?: string | null }
  type DeviceTypeRow = { name?: string | null; device_brands?: BrandRow | BrandRow[] | null }
  type DeviceModelRow = {
    id: string
    model?: string | null
    device_types?: DeviceTypeRow | DeviceTypeRow[] | null
  }

  const rows = (data || []).map((row: DeviceModelRow) => {
    const dt = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
    const brandRow = dt && (Array.isArray(dt.device_brands) ? dt.device_brands[0] : dt.device_brands)
    return {
      id: row.id,
      model: row.model ?? '',
      brand: brandRow?.name ?? '',
      device_type: dt?.name ?? '',
    }
  })

  return rows
}
