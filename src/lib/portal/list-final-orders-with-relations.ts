import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FINALIZED_ORDER_STATUSES,
  FINALIZED_ORDER_STATUS_SET,
} from '@/lib/orders/order-status'
import type {
  PortalOrdensCustomerSummary,
  PortalOrdensDeviceModelSummary,
  PortalOrdensListRow,
  PortalServiceOrderListQueryRow,
} from '@/lib/orders/portal-ordens-list-types'

/** Limite alinhado à listagem final (RSC e API). */
export const PORTAL_FINAL_ORDERS_LIST_LIMIT = 500

export function mapDeviceModelJoinToSummary(d: {
  id: string
  model: string | null
  device_types?: unknown
}): PortalOrdensDeviceModelSummary {
  const dtRaw = d.device_types
  const dt = (Array.isArray(dtRaw) ? dtRaw[0] : dtRaw) as
    | { name?: string | null; device_brands?: unknown }
    | null
    | undefined
  const brRaw = dt?.device_brands
  const br = Array.isArray(brRaw) ? brRaw[0] : brRaw
  const brandName =
    br && typeof br === 'object' && br !== null && 'name' in br
      ? (br as { name: string | null }).name ?? null
      : null
  return {
    id: d.id,
    brand: brandName,
    device_type: dt?.name ?? null,
    model: d.model ?? null,
  }
}

export type FinalOrdersListFilters = {
  q?: string
  cpf?: string
  osNumber?: string
  statusFilter?: string
  filterCustomerId?: string
  filterCustomerName?: string
  filterDeviceModelId?: string
  filterCreatedFrom?: string
  filterCreatedTo?: string
  filterReadyFrom?: string
  filterReadyTo?: string
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/**
 * Lista ordens com status final + cliente e modelo de dispositivo resolvidos.
 * Mesma lógica usada pelo GET /api/portal/ordens?statusGroup=final.
 */
export async function listFinalOrdersWithRelations(
  supabase: SupabaseClient,
  filters: FinalOrdersListFilters,
  options?: { limit?: number },
): Promise<{ orders: PortalOrdensListRow[]; error: { message: string; code?: string } | null }> {
  const limit = options?.limit ?? PORTAL_FINAL_ORDERS_LIST_LIMIT
  const q = filters.q ?? ''
  const cpf = (filters.cpf ?? '').replace(/\D/g, '').trim()
  const osNumber = filters.osNumber ?? ''
  const statusFilter = filters.statusFilter ?? ''
  const filterCustomerId = filters.filterCustomerId ?? ''
  const filterCustomerName = filters.filterCustomerName ?? ''
  const filterDeviceModelId = filters.filterDeviceModelId ?? ''
  const filterCreatedFrom = filters.filterCreatedFrom ?? ''
  const filterCreatedTo = filters.filterCreatedTo ?? ''
  const filterReadyFrom = filters.filterReadyFrom ?? ''
  const filterReadyTo = filters.filterReadyTo ?? ''

  let customerIdsFilter: string[] | null = null
  if (filterCustomerId) {
    customerIdsFilter = [filterCustomerId]
  } else if (filterCustomerName && filterCustomerName.length >= 2) {
    const escaped = filterCustomerName.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data: custList } = await supabase
      .from('customers')
      .select('id')
      .or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,trade_name.ilike.%${escaped}%`)
      .limit(100)
    customerIdsFilter = custList && custList.length > 0 ? custList.map((c: { id: string }) => c.id) : []
  } else if (cpf) {
    const { data: custList } = await supabase
      .from('customers')
      .select('id')
      .or(`cpf.eq.${cpf},cnpj.eq.${cpf}`)
    customerIdsFilter = (custList || []).map((c: { id: string }) => c.id)
    if (customerIdsFilter.length === 0) {
      return { orders: [], error: null }
    }
  }

  const baseQuery = supabase
    .from('service_orders')
    .select(
      'id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id',
    )
    .in('status', [...FINALIZED_ORDER_STATUSES])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    const escaped = q.replaceAll(',', ' ').trim()
    baseQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }
  if (osNumber) {
    const displayNum = Number.parseInt(osNumber, 10)
    if (!Number.isNaN(displayNum)) {
      baseQuery.eq('display_number', displayNum)
    }
  }
  if (statusFilter && FINALIZED_ORDER_STATUS_SET.has(statusFilter)) {
    baseQuery.eq('status', statusFilter)
  }
  if (customerIdsFilter !== null) {
    if (customerIdsFilter.length === 0) {
      baseQuery.eq('customer_id', '00000000-0000-0000-0000-000000000000')
    } else {
      baseQuery.in('customer_id', customerIdsFilter)
    }
  }
  if (filterDeviceModelId) baseQuery.eq('device_model_id', filterDeviceModelId)
  if (filterCreatedFrom && isValidDate(filterCreatedFrom)) {
    baseQuery.gte('created_at', `${filterCreatedFrom}T00:00:00.000Z`)
  }
  if (filterCreatedTo && isValidDate(filterCreatedTo)) {
    baseQuery.lte('created_at', `${filterCreatedTo}T23:59:59.999Z`)
  }
  if (filterReadyFrom && isValidDate(filterReadyFrom)) {
    baseQuery.gte('estimated_ready_at', `${filterReadyFrom}T00:00:00.000Z`)
  }
  if (filterReadyTo && isValidDate(filterReadyTo)) {
    baseQuery.lte('estimated_ready_at', `${filterReadyTo}T23:59:59.999Z`)
  }

  const { data: ordersList, error } = await baseQuery
  if (error) {
    return { orders: [], error: { message: error.message, code: error.code } }
  }

  const list = (ordersList ?? []) as PortalServiceOrderListQueryRow[]
  const customerIds = [...new Set(list.map((o) => o.customer_id).filter(Boolean))]
  const deviceModelIds = [...new Set(list.map((o) => o.device_model_id).filter(Boolean))]

  let customersMap: Record<string, PortalOrdensCustomerSummary> = {}
  let deviceModelsMap: Record<string, PortalOrdensDeviceModelSummary> = {}

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, cpf, cnpj, is_company, full_name, company_name, email, mobile_phone')
      .in('id', customerIds)
    customersMap = (customers ?? []).reduce<Record<string, PortalOrdensCustomerSummary>>((acc, c) => {
      acc[c.id] = c as PortalOrdensCustomerSummary
      return acc
    }, {})
  }
  if (deviceModelIds.length > 0) {
    const { data: deviceModelsJoined } = await supabase
      .from('device_models')
      .select('id, model, device_types ( name, device_brands ( name ) )')
      .in('id', deviceModelIds)
    deviceModelsMap = (deviceModelsJoined ?? []).reduce<
      Record<string, PortalOrdensDeviceModelSummary>
    >((acc, d) => {
      const s = mapDeviceModelJoinToSummary(d)
      acc[d.id] = s
      return acc
    }, {})
  }

  const orders: PortalOrdensListRow[] = list.map((o) => ({
    ...o,
    customers: o.customer_id ? customersMap[o.customer_id] ?? null : null,
    device_models: o.device_model_id ? deviceModelsMap[o.device_model_id] ?? null : null,
  }))

  return { orders, error: null }
}
