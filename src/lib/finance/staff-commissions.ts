import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveOrderCommissionCents,
  resolveOrderPartialNetCents,
} from '@/lib/orders/order-discount-commission'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import {
  paymentFeeCentsForSaleEntries,
  paymentGrossCentsForSaleEntries,
} from '@/lib/resale/resale-commission'
import {
  isCommissionCostDescription,
  parseCommissionWorkerLabelFromDescription,
} from '@/lib/resale/resale-sale-costs'

export type StaffCommissionSource = 'os' | 'resale'

export type StaffCommissionItem = {
  id: string
  source: StaffCommissionSource
  sourceId: string
  href: string
  label: string
  userId: string | null
  userDisplayName: string
  amountCents: number
  earnedAt: string
  paidAt: string | null
  isPaid: boolean
}

export type StaffCommissionListFilters = {
  organizationId: string
  from: string
  to: string
  status?: 'all' | 'pending' | 'paid'
  source?: 'all' | StaffCommissionSource
}

type OrderRow = {
  id: string
  display_number: number | string | null
  title: string | null
  status: string
  closed_at: string | null
  updated_at: string | null
  services_total_cents: number | null
  services_cost_total_cents: number | null
  discount_cents: number | null
  payment_methods: unknown
  commission_user_id: string | null
  commission_kind: string | null
  commission_fixed_cents: number | null
  commission_percent: number | null
  commission_paid_at: string | null
}

type ResaleRow = {
  id: string
  sale_date: string | null
  sold_for_cents: number | null
  device_name: string | null
  model: string | null
  device_model_id: string | null
  sale_commission_user_id: string | null
  commission_paid_at: string | null
}

type PaymentMethodCatalogRow = {
  id: string
  fee_percent: number
  type: string
  credit_installment_fees?: Array<{ installments: number; fee_percent: number }> | null
}

const OS_COMMISSION_STATUSES = [
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
] as const

function ymd (isoOrDate: string | null | undefined): string {
  return String(isoOrDate || '').slice(0, 10)
}

function userLabel (
  usersMap: Map<string, string>,
  userId: string | null,
  fallback?: string | null,
): string {
  if (userId && usersMap.has(userId)) return usersMap.get(userId) || 'Colaborador'
  const fb = String(fallback || '').trim()
  return fb || 'Colaborador'
}

function parseUuid (raw: unknown): string | null {
  const s = String(raw || '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return null
  }
  return s
}

function parseOrderPaymentEntries (raw: unknown): Array<{
  payment_method_id: string
  value_cents: number | null
  installments: number
}> {
  if (!Array.isArray(raw)) return []
  const out: Array<{
    payment_method_id: string
    value_cents: number | null
    installments: number
  }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as {
      payment_method_id?: unknown
      value_cents?: unknown
      installments?: unknown
    }
    const paymentMethodId = parseUuid(row.payment_method_id)
    if (!paymentMethodId) continue
    const valueCents = Math.max(0, Number(row.value_cents) || 0)
    if (valueCents <= 0) continue
    out.push({
      payment_method_id: paymentMethodId,
      value_cents: valueCents,
      installments: Math.max(1, Number(row.installments) || 1),
    })
  }
  return out
}

async function loadUserNames (
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return map

  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize)
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', slice)
    for (const row of data || []) {
      const name =
        String(row.full_name || '').trim() ||
        String(row.email || '').trim() ||
        'Colaborador'
      map.set(row.id, name)
    }
  }
  return map
}

async function loadPaymentMethodsCatalog (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PaymentMethodCatalogRow[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, fee_percent, type, credit_installment_fees')
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    fee_percent: Number(row.fee_percent) || 0,
    type: String(row.type || ''),
    credit_installment_fees: Array.isArray(row.credit_installment_fees)
      ? row.credit_installment_fees
      : null,
  }))
}

/** Comissão OS: % sobre líquido parcial (bruto − taxas − custos); fixo permanece fixo. */
function resolveOsCommissionAmountCents (
  row: OrderRow,
  paymentMethods: PaymentMethodCatalogRow[],
): number {
  const entries = parseOrderPaymentEntries(row.payment_methods)
  const brutoCents = paymentGrossCentsForSaleEntries(entries)
  const feeCents = paymentFeeCentsForSaleEntries(entries, paymentMethods)
  const costCents = Math.max(0, Number(row.services_cost_total_cents) || 0)
  const partialNetCents = resolveOrderPartialNetCents(brutoCents, feeCents, costCents)
  return resolveOrderCommissionCents(row, { partialNetCents })
}

async function listOsCommissions (
  supabase: SupabaseClient,
  organizationId: string,
  from: string,
  to: string,
): Promise<StaffCommissionItem[]> {
  const { data, error } = await supabase
    .from('service_orders')
    .select(
      'id, display_number, title, status, closed_at, updated_at, services_total_cents, services_cost_total_cents, discount_cents, payment_methods, commission_user_id, commission_kind, commission_fixed_cents, commission_percent, commission_paid_at',
    )
    .eq('organization_id', organizationId)
    .not('commission_user_id', 'is', null)
    .in('status', [...OS_COMMISSION_STATUSES])
    .gte('closed_at', from)
    .lte('closed_at', `${to}T23:59:59.999`)
    .order('closed_at', { ascending: false })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as OrderRow[]
  if (rows.length === 0) return []

  const paymentMethods = await loadPaymentMethodsCatalog(supabase, organizationId)
  const items: StaffCommissionItem[] = []

  for (const row of rows) {
    const earnedAt = ymd(row.closed_at) || ymd(row.updated_at)
    if (!earnedAt || earnedAt < from || earnedAt > to) continue

    const amountCents = resolveOsCommissionAmountCents(row, paymentMethods)
    if (amountCents <= 0) continue

    const userId = String(row.commission_user_id || '').trim() || null
    const display =
      row.display_number != null && String(row.display_number).trim()
        ? `OS #${row.display_number}`
        : 'OS'
    const title = String(row.title || '').trim()
    items.push({
      id: `os:${row.id}`,
      source: 'os',
      sourceId: row.id,
      href: getOrdemPortalPath(row),
      label: title ? `${display} — ${title}` : display,
      userId,
      userDisplayName: '',
      amountCents,
      earnedAt,
      paidAt: row.commission_paid_at,
      isPaid: Boolean(row.commission_paid_at),
    })
  }

  return items
}

async function listResaleCommissions (
  supabase: SupabaseClient,
  organizationId: string,
  from: string,
  to: string,
): Promise<StaffCommissionItem[]> {
  const { data: soldDevices, error } = await supabase
    .from('resale_devices')
    .select(
      'id, sale_date, sold_for_cents, device_name, model, device_model_id, sale_commission_user_id, commission_paid_at',
    )
    .eq('organization_id', organizationId)
    .eq('sold', true)
    .gte('sale_date', from)
    .lte('sale_date', to)
    .order('sale_date', { ascending: false })
    .limit(2000)

  if (error) {
    throw new Error(error.message)
  }

  const list = (soldDevices || []) as ResaleRow[]
  if (list.length === 0) return []

  const commissionByDevice = new Map<string, { cents: number; labelHint: string | null }>()
  const idList = list.map((d) => d.id)
  const chunkSize = 100
  for (let i = 0; i < idList.length; i += chunkSize) {
    const slice = idList.slice(i, i + chunkSize)
    const { data: costRows, error: costsError } = await supabase
      .from('resale_device_costs')
      .select('resale_device_id, description, value_cents')
      .in('resale_device_id', slice)

    if (costsError) {
      throw new Error(costsError.message)
    }

    for (const row of costRows || []) {
      if (!isCommissionCostDescription(row.description)) continue
      const v = Number(row.value_cents) || 0
      if (v <= 0) continue
      const id = String(row.resale_device_id)
      const prev = commissionByDevice.get(id) ?? { cents: 0, labelHint: null }
      prev.cents += v
      if (!prev.labelHint) {
        prev.labelHint = parseCommissionWorkerLabelFromDescription(row.description)
      }
      commissionByDevice.set(id, prev)
    }
  }

  const modelIds = [
    ...new Set(list.map((d) => d.device_model_id).filter(Boolean) as string[]),
  ]
  const modelsMap = new Map<string, string>()
  for (let i = 0; i < modelIds.length; i += chunkSize) {
    const slice = modelIds.slice(i, i + chunkSize)
    const { data: models } = await supabase
      .from('device_models')
      .select('id, model, device_types ( name, device_brands ( name ) )')
      .in('id', slice)
    for (const m of models || []) {
      const dtRaw = (m as { device_types?: unknown }).device_types
      const dt = Array.isArray(dtRaw) ? dtRaw[0] : dtRaw
      const brRaw = dt && (dt as { device_brands?: unknown }).device_brands
      const br = Array.isArray(brRaw) ? brRaw[0] : brRaw
      const brand = String((br as { name?: string } | null)?.name || '').trim()
      const typeName = String((dt as { name?: string } | null)?.name || '').trim()
      const model = String(m.model || '').trim()
      modelsMap.set(
        m.id,
        [brand, typeName, model].filter(Boolean).join(' ') || model || 'Aparelho',
      )
    }
  }

  const items: StaffCommissionItem[] = []
  for (const d of list) {
    const info = commissionByDevice.get(d.id)
    if (!info || info.cents <= 0) continue
    const earnedAt = ymd(d.sale_date)
    if (!earnedAt) continue

    const modelLabel = d.device_model_id
      ? modelsMap.get(d.device_model_id) || ''
      : ''
    const fallback =
      String(d.device_name || '').trim() ||
      String(d.model || '').trim() ||
      modelLabel ||
      'Aparelho vendido'

    items.push({
      id: `resale:${d.id}`,
      source: 'resale',
      sourceId: d.id,
      href: `/portal/revendaaparelhos/${d.id}`,
      label: fallback,
      userId: String(d.sale_commission_user_id || '').trim() || null,
      userDisplayName: info.labelHint || '',
      amountCents: info.cents,
      earnedAt,
      paidAt: d.commission_paid_at,
      isPaid: Boolean(d.commission_paid_at),
    })
  }

  return items
}

export async function listStaffCommissions (
  supabase: SupabaseClient,
  filters: StaffCommissionListFilters,
): Promise<StaffCommissionItem[]> {
  const status = filters.status || 'all'
  const source = filters.source || 'all'
  const from = ymd(filters.from)
  const to = ymd(filters.to)
  if (!from || !to) return []

  const parts: StaffCommissionItem[][] = []
  if (source === 'all' || source === 'os') {
    parts.push(await listOsCommissions(supabase, filters.organizationId, from, to))
  }
  if (source === 'all' || source === 'resale') {
    parts.push(await listResaleCommissions(supabase, filters.organizationId, from, to))
  }

  let items = parts.flat()
  if (status === 'pending') items = items.filter((i) => !i.isPaid)
  if (status === 'paid') items = items.filter((i) => i.isPaid)

  const usersMap = await loadUserNames(
    supabase,
    items.map((i) => i.userId || '').filter(Boolean),
  )

  for (const item of items) {
    item.userDisplayName = userLabel(usersMap, item.userId, item.userDisplayName)
  }

  items.sort((a, b) => {
    if (a.earnedAt !== b.earnedAt) return b.earnedAt.localeCompare(a.earnedAt)
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1
    return b.amountCents - a.amountCents
  })

  return items
}

export async function setStaffCommissionPaid (
  supabase: SupabaseClient,
  organizationId: string,
  source: StaffCommissionSource,
  sourceId: string,
  paid: boolean,
): Promise<{ paidAt: string | null }> {
  const paidAt = paid ? new Date().toISOString() : null
  const table = source === 'os' ? 'service_orders' : 'resale_devices'

  const { data, error } = await supabase
    .from(table)
    .update({ commission_paid_at: paidAt })
    .eq('id', sourceId)
    .eq('organization_id', organizationId)
    .select('id, commission_paid_at')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('not_found')
  }

  return { paidAt: data.commission_paid_at ?? null }
}
