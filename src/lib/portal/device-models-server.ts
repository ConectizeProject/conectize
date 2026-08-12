import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deviceCatalogOrganizationIds,
  preferHostCatalogRows,
} from '@/lib/organizations/device-catalog'
import { getPortalOrganizationId } from '@/lib/organizations/portal-organization-context'

export type DeviceModelForSelector = {
  id: string
  brand: string
  device_type: string
  model: string
}

const DEFAULT_LIMIT = 1000

/**
 * Busca device models no servidor (para uso em Server Components).
 * Inclui catálogo da Conectize (host) + catálogo da organização atual.
 * Retorna no formato esperado pelo OrderDeviceSelector.
 */
export async function fetchDeviceModelsForSelector (
  supabase: SupabaseClient,
  limit = DEFAULT_LIMIT,
  organizationId?: string | null,
): Promise<DeviceModelForSelector[]> {
  let orgId = String(organizationId || '').trim()
  if (!orgId) {
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (userId) {
      orgId = (await getPortalOrganizationId(supabase, userId)) || ''
    }
  }

  let query = supabase
    .from('device_models')
    .select('id, model, device_type_id, organization_id, device_types ( id, name, device_brands ( id, name ) )')
    .order('model', { ascending: true })
    .limit(Math.min(Math.max(1, limit) * 2, 4000))

  if (orgId) {
    query = query.in('organization_id', deviceCatalogOrganizationIds(orgId))
  }

  const { data, error } = await query

  if (error) return []

  type BrandRow = { name?: string | null }
  type DeviceTypeRow = { name?: string | null; device_brands?: BrandRow | BrandRow[] | null }
  type DeviceModelRow = {
    id: string
    model?: string | null
    device_type_id?: string | null
    organization_id?: string | null
    device_types?: DeviceTypeRow | DeviceTypeRow[] | null
  }

  const mapped = (data || []).map((row: DeviceModelRow) => {
    const dt = Array.isArray(row.device_types) ? row.device_types[0] : row.device_types
    const brandRow = dt && (Array.isArray(dt.device_brands) ? dt.device_brands[0] : dt.device_brands)
    return {
      id: row.id,
      model: row.model ?? '',
      brand: brandRow?.name ?? '',
      device_type: dt?.name ?? '',
      organization_id: row.organization_id ?? null,
      device_type_id: row.device_type_id ?? null,
    }
  })

  const deduped = preferHostCatalogRows(
    mapped,
    (row) => `${row.brand}::${row.device_type}::${row.model}`,
  )
    .sort((a, b) => a.model.localeCompare(b.model, 'pt-BR', { sensitivity: 'base' }))
    .slice(0, Math.min(Math.max(1, limit), 2000))

  return deduped.map(({ id, brand, device_type, model }) => ({ id, brand, device_type, model }))
}
