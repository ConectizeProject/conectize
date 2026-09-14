import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildNfceFromPreparedOrder,
  type BuildNfceResult,
} from '@/lib/fiscal/build-nfce-from-sales-order'
import { nfcePaymentTypeFromCatalog } from '@/lib/fiscal/payment-method-type'
import {
  resolveOrderDiscountCents,
  type OrderDiscountMode,
} from '@/lib/orders/order-discount-commission'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { onlyDigits } from '@/lib/utils/strings'

type FiscalProfileRow = {
  legal_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  state_registration?: string | null
  state_registration_exempt?: boolean | null
  municipal_registration?: string | null
  tax_regime?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  district?: string | null
  zip_code?: string | null
  city?: string | null
  state?: string | null
  ibge_city_code?: string | null
  default_cfop?: string | null
  default_origin?: number | null
  default_unit?: string | null
  default_csosn?: string | null
  default_pis_cst?: string | null
  default_cofins_cst?: string | null
  ibscbs_enabled?: boolean | null
  ibscbs_cst?: string | null
  ibscbs_cclass_trib?: string | null
  fiscal_environment?: 'homologacao' | 'producao'
}

type FiscalOperationNatureRow = {
  description?: string | null
  operation_type?: 'entrada' | 'saida' | null
  presence_indicator?: number | null
  is_final_consumer?: boolean | null
  default_cfop?: string | null
  default_origin?: number | null
  default_unit?: string | null
  icms_csosn?: string | null
  icms_cst?: string | null
  pis_cst?: string | null
  cofins_cst?: string | null
  ibscbs_enabled?: boolean | null
  ibscbs_cst?: string | null
  ibscbs_cclass_trib?: string | null
}

type OsServiceLine = {
  kind: 'service' | 'product'
  description: string
  quantity: number
  valueCents: number
  sourceProductId: string | null
}

type OsPaymentLine = {
  payment_method_id: string
  amount_cents: number
}

const PRODUCT_FISCAL_SELECT = 'id, name, sku, barcode, kind, ncm, cest, cfop, fiscal_origin, fci, fiscal_unit, icms_csosn, icms_cst, pis_cst, cofins_cst'

function toCents (value: unknown) {
  const n = Math.round(Number(value || 0))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function parseServices (raw: unknown): OsServiceLine[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    value = (value as { items: unknown[] }).items
  }
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const kind: 'service' | 'product' = row.kind === 'product' ? 'product' : 'service'
      const quantityRaw = kind === 'product'
        ? Number.parseInt(String(row.quantity ?? '1'), 10)
        : 1
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0
        ? Math.min(9999, Math.max(1, quantityRaw))
        : 1
      const unitValueCents = toCents(row.unitValueCents ?? row.valueCents)
      const valueCents = unitValueCents * quantity
      const description = String(row.description || '').trim()
      if (!description && valueCents <= 0) return null
      return {
        kind,
        description,
        quantity,
        valueCents,
        sourceProductId: parseOptionalUuid(row.sourceProductId),
      }
    })
    .filter((item): item is OsServiceLine => Boolean(item))
}

function parsePayments (raw: unknown): OsPaymentLine[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as { payment_method_id?: unknown, value_cents?: unknown }
      const id = parseOptionalUuid(row.payment_method_id)
      const amountCents = toCents(row.value_cents)
      if (!id || amountCents <= 0) return null
      return { payment_method_id: id, amount_cents: amountCents }
    })
    .filter((item): item is OsPaymentLine => Boolean(item))
}

function customerRecord (raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? first as Record<string, unknown> : null
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function allocateCents (amount: number, weights: number[]): number[] {
  const size = weights.length
  const shares = Array.from({ length: size }, () => 0)
  if (size === 0 || amount <= 0) return shares
  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0))
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight <= 0) {
    shares[size - 1] = amount
    return shares
  }
  const raw = safeWeights.map((weight) => (amount * weight) / totalWeight)
  const floors = raw.map((value) => Math.floor(value))
  let remainder = amount - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction)
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floors[order[i].index] += 1
    remainder -= 1
  }
  return floors
}

export async function buildNfeFromServiceOrder (input: {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
  profile: FiscalProfileRow
  operationNature?: FiscalOperationNatureRow | null
  series: number
  number: number
}): Promise<BuildNfceResult> {
  const { supabase, organizationId, orderId, profile } = input

  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .select('id, display_number, status, services, services_total_cents, discount_cents, discount_mode, discount_percent, payment_methods, customers(full_name, company_name, is_company, cpf, cnpj)')
    .eq('organization_id', organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    return { ok: false, error: 'db_error', message: 'Não foi possível carregar a ordem de serviço.' }
  }
  if (!order) {
    return { ok: false, error: 'order_not_found', message: 'Ordem de serviço não encontrada.' }
  }
  if (String(order.status) === 'cancelada') {
    return { ok: false, error: 'order_canceled', message: 'Não é possível emitir NF-e de uma OS cancelada.' }
  }

  const lines = parseServices(order.services)
  const productLines = lines.filter((line) => line.kind === 'product' && line.sourceProductId && line.valueCents > 0)
  if (productLines.length === 0) {
    return {
      ok: false,
      error: 'nfe_os_no_products',
      message: 'A NF-e da OS inclui só peças/produtos. Adicione peças na ordem ou emita os serviços pela NFS-e.',
    }
  }

  const productIds = [...new Set(productLines.map((line) => String(line.sourceProductId)))]
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(PRODUCT_FISCAL_SELECT)
    .eq('organization_id', organizationId)
    .in('id', productIds)

  if (productsError) {
    return { ok: false, error: 'db_error', message: 'Não foi possível carregar os produtos da OS.' }
  }

  const productsById = new Map((products ?? []).map((row) => [String(row.id), row]))
  const items = productLines.map((line) => ({
    quantity: line.quantity,
    subtotal_cents: line.valueCents,
    products: productsById.get(String(line.sourceProductId)) ?? null,
  }))

  const productGrossCents = items.reduce((sum, item) => sum + item.subtotal_cents, 0)
  const servicesTotalCents = toCents(order.services_total_cents) || lines.reduce((sum, line) => sum + line.valueCents, 0)
  const discountMode = String(order.discount_mode || 'fixed') === 'percent' ? 'percent' : 'fixed' as OrderDiscountMode
  const orderDiscountCents = resolveOrderDiscountCents(
    servicesTotalCents,
    discountMode,
    toCents(order.discount_cents),
    Number(order.discount_percent) || 0,
  )
  const productDiscountCents = servicesTotalCents > 0
    ? Math.min(productGrossCents, Math.round((orderDiscountCents * productGrossCents) / servicesTotalCents))
    : 0
  const fiscalTotalCents = Math.max(0, productGrossCents - productDiscountCents)

  const paymentRows = parsePayments(order.payment_methods)
  const paymentIds = [...new Set(paymentRows.map((row) => row.payment_method_id))]
  const { data: methodRows } = paymentIds.length > 0
    ? await supabase
      .from('payment_methods')
      .select('id, type')
      .eq('organization_id', organizationId)
      .in('id', paymentIds)
    : { data: [] as Array<{ id: string, type: string | null }> }

  const typeById = new Map((methodRows ?? []).map((row) => [String(row.id), String(row.type || '')]))
  const sourcePayments = paymentRows.map((row) => ({
    payment_method_type: nfcePaymentTypeFromCatalog(typeById.get(row.payment_method_id)),
    amount_cents: row.amount_cents,
  }))
  const sourceTotal = sourcePayments.reduce((sum, row) => sum + row.amount_cents, 0)
  const paymentShares = sourceTotal > 0
    ? allocateCents(fiscalTotalCents, sourcePayments.map((item) => item.amount_cents))
    : [fiscalTotalCents]
  const payments = sourceTotal > 0
    ? sourcePayments.map((row, index) => ({
      payment_method_type: row.payment_method_type,
      amount_cents: paymentShares[index] ?? 0,
    })).filter((row) => row.amount_cents > 0)
    : [{ payment_method_type: 'outro', amount_cents: fiscalTotalCents }]

  const customer = customerRecord(order.customers)
  const isCompany = customer?.is_company === true
  const customerName = String(
    isCompany
      ? (customer?.company_name || customer?.full_name || '')
      : (customer?.full_name || customer?.company_name || ''),
  ).trim() || 'Destinatário'
  const customerDocument = onlyDigits(String(customer?.cnpj || customer?.cpf || ''))
  const displayNumber = order.display_number ?? order.id
  const skippedServices = lines.some((line) => line.kind === 'service' && line.valueCents > 0)
  const infoComplementar = skippedServices
    ? `OS Conectize #${displayNumber}. NF-e das pecas; servicos nao inclusos.`
    : `OS Conectize #${displayNumber}`

  return buildNfceFromPreparedOrder({
    supabase,
    organizationId,
    profile,
    operationNature: input.operationNature,
    series: input.series,
    number: input.number,
    model: '55',
    order: {
      order_number: displayNumber,
      customer_name: customerName,
      customer_document: customerDocument || null,
      discount_total_cents: productDiscountCents,
      surcharge_cents: 0,
      total_cents: fiscalTotalCents,
      change_cents: 0,
    },
    items,
    payments,
    infoComplementar,
  })
}
