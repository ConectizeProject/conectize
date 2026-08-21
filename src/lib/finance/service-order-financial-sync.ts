import type { SupabaseClient } from '@supabase/supabase-js'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  coerceRawSalePaymentsToArray,
  mapLooseEntryToSalePaymentRow,
} from '@/lib/resale/sale-payment-methods'

type PaymentMethodRow = {
  id: string
  type?: string | null
  conta_id: string | null
  description?: string | null
}

const SALES_ORDER_PAYMENT_TYPE_TO_METHOD_TYPES: Record<string, string[]> = {
  dinheiro: ['dinheiro'],
  pix: ['pix_direto', 'pix_maquina'],
  credito: ['credito'],
  debito: ['debito'],
  outro: ['dinheiro', 'pix_direto', 'pix_maquina', 'credito', 'debito'],
}

type ServiceOrderFinanceRow = {
  id: string
  organization_id: string
  display_number: number | null
  payment_methods: unknown
  closed_at: string | null
  updated_at: string | null
}

type ParsedPaymentMethodItem = {
  payment_method_id: string
  value_cents: number
}

type SyncOptions = {
  supabase: SupabaseClient
  orderId: string
  organizationId: string
  orderRow?: ServiceOrderFinanceRow
}

type ResaleDeviceFinanceRow = {
  id: string
  organization_id: string
  device_name: string | null
  model: string | null
  sold: boolean | null
  sold_for_cents: number | null
  sale_payment_methods: unknown
  payment_method_id: string | null
  payment_installments: number | null
  updated_at: string | null
  sale_date: string | null
}

type SalesOrderFinanceRow = {
  id: string
  organization_id: string
  order_number: number | null
  status: string
  updated_at: string | null
  change_cents?: number | null
  total_cents?: number | null
}

type SalesOrderPaymentFinanceRow = {
  id: string
  payment_method_id: string | null
  payment_method_type: string
  amount_cents: number
  status: string | null
  created_at: string | null
}

function parsePaymentMethodsForFinance (raw: unknown): ParsedPaymentMethodItem[] {
  if (!raw) return []
  const items = Array.isArray(raw) ? raw : []
  const parsed: ParsedPaymentMethodItem[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as { payment_method_id?: unknown; value_cents?: unknown }
    const paymentMethodId = parseOptionalUuid(row.payment_method_id)
    if (!paymentMethodId) continue
    const valueCents = Math.max(0, Number(row.value_cents) || 0)
    if (valueCents <= 0) continue
    parsed.push({
      payment_method_id: paymentMethodId,
      value_cents: valueCents,
    })
  }

  return parsed
}

function buildOccurredAt (row: ServiceOrderFinanceRow) {
  const base = row.updated_at || row.closed_at || new Date().toISOString()
  return toSaoPauloDate(base)
}

function toSaoPauloDate (isoLike: string) {
  const date = new Date(isoLike)
  if (Number.isNaN(date.getTime())) {
    return String(isoLike).slice(0, 10)
  }
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return formatted
}

function toSaoPauloIsoStart (dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00-03:00`).toISOString()
}

function toSaoPauloIsoEnd (dateOnly: string) {
  return new Date(`${dateOnly}T23:59:59.999-03:00`).toISOString()
}

async function loadOrganizationPaymentMethods (
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, type, conta_id, description')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })
  if (error) {
    throw new Error(`Erro ao buscar formas de pagamento: ${error.message}`)
  }
  return (data ?? []) as PaymentMethodRow[]
}

async function loadDefaultContaId (
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('contas')
    .select('id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`Erro ao buscar carteira padrão: ${error.message}`)
  }
  return data?.id ? String(data.id) : null
}

function resolveContaForSalesOrderPayment (
  payment: Pick<SalesOrderPaymentFinanceRow, 'payment_method_id' | 'payment_method_type'>,
  methods: PaymentMethodRow[],
  defaultContaId: string | null,
) {
  const methodsWithConta = methods.filter((method) => Boolean(method.conta_id))
  const methodId = parseOptionalUuid(payment.payment_method_id)

  if (methodId) {
    const selected = methods.find((method) => method.id === methodId)
    if (selected?.conta_id) {
      return {
        contaId: String(selected.conta_id),
        label: String(selected.description || '').trim() || 'Forma de pagamento',
      }
    }
  }

  const preferredTypes = SALES_ORDER_PAYMENT_TYPE_TO_METHOD_TYPES[payment.payment_method_type]
    ?? SALES_ORDER_PAYMENT_TYPE_TO_METHOD_TYPES.outro
  for (const type of preferredTypes) {
    const matched = methodsWithConta.find((method) => method.type === type)
    if (matched?.conta_id) {
      return {
        contaId: String(matched.conta_id),
        label: String(matched.description || '').trim() || 'Forma de pagamento',
      }
    }
  }

  const fallbackMethod = methodsWithConta[0]
  if (fallbackMethod?.conta_id) {
    return {
      contaId: String(fallbackMethod.conta_id),
      label: String(fallbackMethod.description || '').trim() || 'Forma de pagamento',
    }
  }

  if (defaultContaId) {
    return { contaId: defaultContaId, label: 'Carteira padrão' }
  }

  return { contaId: null, label: '' }
}

/**
 * Ajusta valores de pagamento para o financeiro.
 *
 * Dois modelos coexistem:
 * - Gross (legado / paid − change === total): linhas incluem o valor recebido; abate o troco do dinheiro.
 * - Net (PDV atual: paid === total, change separado do "recebido"): não abate — as linhas já são o líquido da venda.
 */
function netSalesOrderPaymentAmounts (
  payments: SalesOrderPaymentFinanceRow[],
  changeCents: number,
  totalCents: number,
) {
  const paidSum = payments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.amount_cents) || 0),
    0,
  )
  const change = Math.max(0, changeCents)
  const total = Math.max(0, totalCents)
  const paymentsAreGross = change > 0 && total > 0 && paidSum - change === total

  if (!paymentsAreGross) {
    return payments
      .map((payment) => ({
        ...payment,
        amount_cents: Math.max(0, Number(payment.amount_cents) || 0),
      }))
      .filter((payment) => payment.amount_cents > 0)
  }

  let changeRemaining = change
  return payments.map((payment) => {
    let amount = Math.max(0, Number(payment.amount_cents) || 0)
    if (payment.payment_method_type === 'dinheiro' && changeRemaining > 0 && amount > 0) {
      const deduct = Math.min(amount, changeRemaining)
      amount -= deduct
      changeRemaining -= deduct
    }
    return { ...payment, amount_cents: amount }
  }).filter((payment) => payment.amount_cents > 0)
}

export async function syncServiceOrderFinancialTransactions ({
  supabase,
  orderId,
  organizationId,
  orderRow,
}: SyncOptions) {
  const order = orderRow ?? await fetchOrderForSync({
    supabase,
    orderId,
    organizationId,
  })
  if (!order) return

  const parsedMethods = parsePaymentMethodsForFinance(order.payment_methods)
  const uniqueMethodIds = [...new Set(parsedMethods.map((item) => item.payment_method_id))]

  let paymentMethods: PaymentMethodRow[] = []
  if (uniqueMethodIds.length > 0) {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, conta_id, description')
      .eq('organization_id', organizationId)
      .in('id', uniqueMethodIds)
    if (error) {
      throw new Error(`Erro ao buscar formas de pagamento da OS: ${error.message}`)
    }
    paymentMethods = (data ?? []) as PaymentMethodRow[]
  }

  const contaByPaymentMethodId = new Map<string, string>()
  const descriptionByPaymentMethodId = new Map<string, string>()
  for (const method of paymentMethods) {
    if (!method.conta_id) continue
    contaByPaymentMethodId.set(method.id, method.conta_id)
    descriptionByPaymentMethodId.set(method.id, String(method.description || '').trim())
  }

  const occurredAt = buildOccurredAt(order)
  const financeSupabase = getFinanceWriteClient(supabase)
  const transactionsToInsert = parsedMethods
    .map((item) => {
      const contaId = contaByPaymentMethodId.get(item.payment_method_id)
      if (!contaId) return null
      const paymentMethodLabel = descriptionByPaymentMethodId.get(item.payment_method_id) || 'Metodo de pagamento'
      return {
        organization_id: organizationId,
        conta_id: contaId,
        amount_cents: item.value_cents,
        type: 'entrada',
        occurred_at: occurredAt,
        service_order_id: order.id,
        description: `OS #${order.display_number ?? 'S/N'} - ${paymentMethodLabel}`,
      }
    })
    .filter(Boolean)

  const { error: deleteError } = await financeSupabase
    .from('financial_transactions')
    .delete()
    .eq('service_order_id', order.id)
  if (deleteError) {
    throw new Error(`Erro ao limpar transações financeiras antigas da OS: ${deleteError.message}`)
  }

  if (transactionsToInsert.length === 0) return

  const { error: insertError } = await financeSupabase
    .from('financial_transactions')
    .insert(transactionsToInsert)
  if (insertError) {
    throw new Error(`Erro ao inserir transações financeiras da OS: ${insertError.message}`)
  }

  await dedupeServiceOrderFinancialTransactions({
    supabase: financeSupabase,
    orderId: order.id,
  })
}

export async function backfillServiceOrderFinancialTransactionsByOrganization ({
  supabase,
  organizationId,
  pageSize = 200,
  fromDate,
  toDate,
}: {
  supabase: SupabaseClient
  organizationId: string
  pageSize?: number
  fromDate?: string | null
  toDate?: string | null
}) {
  const safePageSize = Math.max(50, Math.min(500, Number(pageSize) || 200))
  const hasFromDate = Boolean(fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate))
  const hasToDate = Boolean(toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate))
  const fromIso = toSaoPauloIsoStart(hasFromDate ? String(fromDate) : '1900-01-01')
  const toIso = toSaoPauloIsoEnd(hasToDate ? String(toDate) : '2999-12-31')

  if (hasFromDate || hasToDate) {
    const [ordersResult, resaleResult, salesOrdersResult] = await Promise.all([
      syncOrdersByPeriodSignals({
        supabase,
        organizationId,
        fromIso,
        toIso,
        pageSize: safePageSize,
      }),
      syncResaleDevicesByPeriod({
        supabase,
        organizationId,
        fromIso,
        toIso,
        pageSize: safePageSize,
      }),
      syncSalesOrdersByPeriod({
        supabase,
        organizationId,
        fromIso,
        toIso,
        pageSize: safePageSize,
      }),
    ])
    return {
      syncedOrders: ordersResult.syncedOrders,
      syncedResaleDevices: resaleResult.syncedResaleDevices,
      syncedSalesOrders: salesOrdersResult.syncedSalesOrders,
    }
  }

  const [allOrdersResult, allResaleResult, allSalesOrdersResult] = await Promise.all([
    syncAllOrdersByOrganization({
      supabase,
      organizationId,
      pageSize: safePageSize,
    }),
    syncAllResaleDevicesByOrganization({
      supabase,
      organizationId,
      pageSize: safePageSize,
    }),
    syncAllSalesOrdersByOrganization({
      supabase,
      organizationId,
      pageSize: safePageSize,
    }),
  ])

  return {
    syncedOrders: allOrdersResult.syncedOrders,
    syncedResaleDevices: allResaleResult.syncedResaleDevices,
    syncedSalesOrders: allSalesOrdersResult.syncedSalesOrders,
  }
}

async function syncAllOrdersByOrganization ({
  supabase,
  organizationId,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  pageSize: number
}) {
  let from = 0
  let syncedOrders = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('service_orders')
      .select('id, organization_id, display_number, payment_methods, closed_at, updated_at')
      .eq('organization_id', organizationId)
      .range(from, to)
      .order('updated_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao carregar OS para backfill financeiro: ${error.message}`)
    }

    const rows = (data ?? []) as ServiceOrderFinanceRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      await syncServiceOrderFinancialTransactions({
        supabase,
        orderId: row.id,
        organizationId,
        orderRow: row,
      })
      syncedOrders += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return { syncedOrders }
}

async function syncOrdersByPeriodSignals ({
  supabase,
  organizationId,
  fromIso,
  toIso,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  fromIso: string
  toIso: string
  pageSize: number
}) {
  const orderIds = new Set<string>()

  const { data: updatedOrders, error: updatedOrdersError } = await supabase
    .from('service_orders')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('updated_at', fromIso)
    .lte('updated_at', toIso)
  if (updatedOrdersError) {
    throw new Error(`Erro ao buscar OS atualizadas no período: ${updatedOrdersError.message}`)
  }
  for (const row of updatedOrders ?? []) {
    const id = String((row as { id?: string }).id || '')
    if (id) orderIds.add(id)
  }

  const { data: paymentEditHistory, error: editHistoryError } = await supabase
    .from('service_order_edit_history')
    .select('service_order_id')
    .eq('organization_id', organizationId)
    .eq('field_key', 'payment_methods')
    .gte('edited_at', fromIso)
    .lte('edited_at', toIso)
  if (editHistoryError) {
    throw new Error(`Erro ao buscar histórico de pagamentos no período: ${editHistoryError.message}`)
  }
  for (const row of paymentEditHistory ?? []) {
    const id = String((row as { service_order_id?: string }).service_order_id || '')
    if (id) orderIds.add(id)
  }

  const ids = Array.from(orderIds)
  if (ids.length === 0) {
    return { syncedOrders: 0 }
  }

  let syncedOrders = 0
  for (let i = 0; i < ids.length; i += pageSize) {
    const chunk = ids.slice(i, i + pageSize)
    const { data, error } = await supabase
      .from('service_orders')
      .select('id, organization_id, display_number, payment_methods, closed_at, updated_at')
      .eq('organization_id', organizationId)
      .in('id', chunk)

    if (error) {
      throw new Error(`Erro ao carregar OS filtradas para sincronização: ${error.message}`)
    }

    for (const row of (data ?? []) as ServiceOrderFinanceRow[]) {
      await syncServiceOrderFinancialTransactions({
        supabase,
        orderId: row.id,
        organizationId,
        orderRow: row,
      })
      syncedOrders += 1
    }
  }

  return { syncedOrders }
}

export async function syncResaleDeviceFinancialTransactions ({
  supabase,
  organizationId,
  resaleDeviceId,
  deviceRow,
}: {
  supabase: SupabaseClient
  organizationId: string
  resaleDeviceId: string
  deviceRow?: ResaleDeviceFinanceRow
}) {
  const device = deviceRow ?? await fetchResaleDeviceForSync({
    supabase,
    organizationId,
    resaleDeviceId,
  })
  if (!device) return

  const financeSupabase = getFinanceWriteClient(supabase)

  const { error: deleteError } = await financeSupabase
    .from('financial_transactions')
    .delete()
    .eq('resale_device_id', device.id)
    .eq('type', 'entrada')
  if (deleteError) {
    throw new Error(`Erro ao limpar transações financeiras antigas do aparelho vendido: ${deleteError.message}`)
  }

  if (!device.sold) return

  const soldFor = Math.max(0, Number(device.sold_for_cents) || 0)
  if (soldFor <= 0) return

  const parsedPayments = parseResalePaymentsForFinance(device)
  if (parsedPayments.length === 0) return

  const uniqueMethodIds = [...new Set(parsedPayments.map((item) => item.payment_method_id))]
  const { data: paymentMethods, error: paymentMethodsError } = await supabase
    .from('payment_methods')
    .select('id, conta_id, description')
    .eq('organization_id', organizationId)
    .in('id', uniqueMethodIds)
  if (paymentMethodsError) {
    throw new Error(`Erro ao buscar formas de pagamento do aparelho vendido: ${paymentMethodsError.message}`)
  }

  const contaByPaymentMethodId = new Map<string, string>()
  const descriptionByPaymentMethodId = new Map<string, string>()
  for (const method of (paymentMethods ?? []) as PaymentMethodRow[]) {
    if (!method.conta_id) continue
    contaByPaymentMethodId.set(method.id, method.conta_id)
    descriptionByPaymentMethodId.set(method.id, String(method.description || '').trim())
  }

  const occurredAt = buildResaleOccurredAt(device)
  const rows = parsedPayments
    .map((item, index) => {
      const contaId = contaByPaymentMethodId.get(item.payment_method_id)
      if (!contaId) return null
      const paymentMethodLabel = descriptionByPaymentMethodId.get(item.payment_method_id) || 'Metodo de pagamento'
      const resaleLabel = buildResaleDeviceLabel(device)
      return {
        organization_id: organizationId,
        conta_id: contaId,
        amount_cents: item.value_cents,
        type: 'entrada',
        occurred_at: occurredAt,
        resale_device_id: device.id,
        description: `${resaleLabel} - ${paymentMethodLabel}`,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) return

  const { error: insertError } = await financeSupabase
    .from('financial_transactions')
    .insert(rows)
  if (insertError) {
    throw new Error(`Erro ao inserir transações financeiras do aparelho vendido: ${insertError.message}`)
  }

  await dedupeResaleDeviceFinancialTransactions({
    supabase: financeSupabase,
    resaleDeviceId: device.id,
  })
}

export async function syncResaleDevicePurchaseFinancialTransactions ({
  supabase,
  organizationId,
  resaleDeviceId,
  deviceRow,
}: {
  supabase: SupabaseClient
  organizationId: string
  resaleDeviceId: string
  deviceRow?: ResalePurchaseFinanceRow
}) {
  const device = deviceRow ?? await fetchResaleDeviceForPurchaseSync({
    supabase,
    organizationId,
    resaleDeviceId,
  })
  if (!device) return

  const financeSupabase = getFinanceWriteClient(supabase)

  const { error: deleteError } = await financeSupabase
    .from('financial_transactions')
    .delete()
    .eq('resale_device_id', device.id)
    .eq('type', 'saida')
  if (deleteError) {
    throw new Error(`Erro ao limpar saídas financeiras da compra do aparelho: ${deleteError.message}`)
  }

  if (device.acquisition_source !== 'customer_purchase') return

  const purchaseValue = Math.max(0, Number(device.purchase_value_cents) || 0)
  if (purchaseValue <= 0) return

  const parsedPayments = parseResalePurchasePaymentsForFinance(device)
  if (parsedPayments.length === 0) return

  const uniqueMethodIds = [...new Set(parsedPayments.map((item) => item.payment_method_id))]
  const { data: paymentMethods, error: paymentMethodsError } = await supabase
    .from('payment_methods')
    .select('id, conta_id, description')
    .eq('organization_id', organizationId)
    .in('id', uniqueMethodIds)
  if (paymentMethodsError) {
    throw new Error(`Erro ao buscar formas de pagamento da compra do aparelho: ${paymentMethodsError.message}`)
  }

  const contaByPaymentMethodId = new Map<string, string>()
  const descriptionByPaymentMethodId = new Map<string, string>()
  for (const method of (paymentMethods ?? []) as PaymentMethodRow[]) {
    if (!method.conta_id) continue
    contaByPaymentMethodId.set(method.id, method.conta_id)
    descriptionByPaymentMethodId.set(method.id, String(method.description || '').trim())
  }

  const occurredAt = buildResalePurchaseOccurredAt(device)
  const rows = parsedPayments
    .map((item) => {
      const contaId = contaByPaymentMethodId.get(item.payment_method_id)
      if (!contaId) return null
      const paymentMethodLabel = descriptionByPaymentMethodId.get(item.payment_method_id) || 'Metodo de pagamento'
      const resaleLabel = buildResaleDeviceLabel(device)
      return {
        organization_id: organizationId,
        conta_id: contaId,
        amount_cents: -Math.abs(item.value_cents),
        type: 'saida',
        occurred_at: occurredAt,
        resale_device_id: device.id,
        description: `Compra usado — ${resaleLabel} - ${paymentMethodLabel}`,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) return

  const { error: insertError } = await financeSupabase
    .from('financial_transactions')
    .insert(rows)
  if (insertError) {
    throw new Error(`Erro ao inserir saídas financeiras da compra do aparelho: ${insertError.message}`)
  }
}

type ResalePurchaseFinanceRow = {
  id: string
  organization_id: string
  device_name: string | null
  model: string | null
  acquisition_source: string | null
  purchase_value_cents: number | null
  purchase_payment_methods: unknown
  purchase_date: string | null
  updated_at: string | null
}

function parseResalePurchasePaymentsForFinance (device: ResalePurchaseFinanceRow) {
  const purchaseValue = Math.max(0, Number(device.purchase_value_cents) || 0)
  const fromJson = coerceRawSalePaymentsToArray(device.purchase_payment_methods)
    .map(mapLooseEntryToSalePaymentRow)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      payment_method_id: parseOptionalUuid(item.payment_method_id) || '',
      value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
    }))
    .filter((item) => Boolean(item.payment_method_id))

  if (fromJson.length > 0) {
    const withKnownValues = fromJson.filter((item) => (item.value_cents ?? 0) > 0)
    if (withKnownValues.length > 0) {
      return withKnownValues.map((item) => ({
        payment_method_id: item.payment_method_id,
        value_cents: item.value_cents as number,
      }))
    }
    if (purchaseValue > 0 && fromJson.length === 1) {
      return [{
        payment_method_id: fromJson[0].payment_method_id,
        value_cents: purchaseValue,
      }]
    }
  }

  return []
}

function buildResalePurchaseOccurredAt (row: ResalePurchaseFinanceRow) {
  const base = row.purchase_date || row.updated_at || new Date().toISOString()
  return toSaoPauloDate(base)
}

async function fetchResaleDeviceForPurchaseSync ({
  supabase,
  organizationId,
  resaleDeviceId,
}: {
  supabase: SupabaseClient
  organizationId: string
  resaleDeviceId: string
}) {
  const { data, error } = await supabase
    .from('resale_devices')
    .select('id, organization_id, device_name, model, acquisition_source, purchase_value_cents, purchase_payment_methods, purchase_date, updated_at')
    .eq('id', resaleDeviceId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) {
    throw new Error(`Erro ao carregar aparelho para sincronização da compra: ${error.message}`)
  }
  return (data ?? null) as ResalePurchaseFinanceRow | null
}

function parseResalePaymentsForFinance (device: ResaleDeviceFinanceRow) {
  const soldFor = Math.max(0, Number(device.sold_for_cents) || 0)
  const fromJson = coerceRawSalePaymentsToArray(device.sale_payment_methods)
    .map(mapLooseEntryToSalePaymentRow)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      payment_method_id: parseOptionalUuid(item.payment_method_id) || '',
      value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
    }))
    .filter((item) => Boolean(item.payment_method_id))

  if (fromJson.length > 0) {
    const withKnownValues = fromJson.filter((item) => (item.value_cents ?? 0) > 0)
    if (withKnownValues.length > 0) {
      return withKnownValues.map((item) => ({
        payment_method_id: item.payment_method_id,
        value_cents: item.value_cents as number,
      }))
    }
    if (soldFor > 0 && fromJson.length === 1) {
      return [{
        payment_method_id: fromJson[0].payment_method_id,
        value_cents: soldFor,
      }]
    }
  }

  const legacyMethodId = parseOptionalUuid(device.payment_method_id)
  if (legacyMethodId && soldFor > 0) {
    return [{ payment_method_id: legacyMethodId, value_cents: soldFor }]
  }

  return []
}

function buildResaleOccurredAt (row: ResaleDeviceFinanceRow) {
  const base = row.updated_at || row.sale_date || new Date().toISOString()
  return toSaoPauloDate(base)
}

async function fetchResaleDeviceForSync ({
  supabase,
  organizationId,
  resaleDeviceId,
}: {
  supabase: SupabaseClient
  organizationId: string
  resaleDeviceId: string
}) {
  const { data, error } = await supabase
    .from('resale_devices')
    .select('id, organization_id, device_name, model, sold, sold_for_cents, sale_payment_methods, payment_method_id, payment_installments, updated_at, sale_date')
    .eq('id', resaleDeviceId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) {
    throw new Error(`Erro ao carregar aparelho vendido para sincronização financeira: ${error.message}`)
  }
  return (data ?? null) as ResaleDeviceFinanceRow | null
}

async function syncAllResaleDevicesByOrganization ({
  supabase,
  organizationId,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  pageSize: number
}) {
  let from = 0
  let syncedResaleDevices = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('resale_devices')
      .select('id, organization_id, device_name, model, sold, sold_for_cents, sale_payment_methods, payment_method_id, payment_installments, updated_at, sale_date')
      .eq('organization_id', organizationId)
      .range(from, to)
      .order('updated_at', { ascending: false })
    if (error) {
      throw new Error(`Erro ao carregar aparelhos vendidos para backfill financeiro: ${error.message}`)
    }

    const rows = (data ?? []) as ResaleDeviceFinanceRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      await syncResaleDeviceFinancialTransactions({
        supabase,
        organizationId,
        resaleDeviceId: row.id,
        deviceRow: row,
      })
      syncedResaleDevices += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return { syncedResaleDevices }
}

async function syncResaleDevicesByPeriod ({
  supabase,
  organizationId,
  fromIso,
  toIso,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  fromIso: string
  toIso: string
  pageSize: number
}) {
  const { data: idsData, error: idsError } = await supabase
    .from('resale_devices')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('updated_at', fromIso)
    .lte('updated_at', toIso)
  if (idsError) {
    throw new Error(`Erro ao buscar aparelhos vendidos no período: ${idsError.message}`)
  }

  const ids = (idsData ?? [])
    .map((row) => String((row as { id?: string }).id || ''))
    .filter(Boolean)
  if (ids.length === 0) return { syncedResaleDevices: 0 }

  let syncedResaleDevices = 0
  for (let i = 0; i < ids.length; i += pageSize) {
    const chunk = ids.slice(i, i + pageSize)
    const { data, error } = await supabase
      .from('resale_devices')
      .select('id, organization_id, device_name, model, sold, sold_for_cents, sale_payment_methods, payment_method_id, payment_installments, updated_at, sale_date')
      .eq('organization_id', organizationId)
      .in('id', chunk)
    if (error) {
      throw new Error(`Erro ao carregar aparelhos vendidos filtrados para sincronização: ${error.message}`)
    }
    for (const row of (data ?? []) as ResaleDeviceFinanceRow[]) {
      await syncResaleDeviceFinancialTransactions({
        supabase,
        organizationId,
        resaleDeviceId: row.id,
        deviceRow: row,
      })
      syncedResaleDevices += 1
    }
  }

  return { syncedResaleDevices }
}

async function dedupeResaleDeviceFinancialTransactions ({
  supabase,
  resaleDeviceId,
}: {
  supabase: SupabaseClient
  resaleDeviceId: string
}) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, conta_id, amount_cents, type, occurred_at, description')
    .eq('resale_device_id', resaleDeviceId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Erro ao deduplicar transações do aparelho vendido: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    id: string
    conta_id: string
    amount_cents: number
    type: string
    occurred_at: string
    description: string | null
  }>
  if (rows.length <= 1) return

  const seen = new Set<string>()
  const duplicateIds: string[] = []
  for (const row of rows) {
    const key = [row.conta_id, row.amount_cents, row.type, row.occurred_at, row.description ?? ''].join('|')
    if (seen.has(key)) duplicateIds.push(row.id)
    else seen.add(key)
  }
  if (duplicateIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('financial_transactions')
    .delete()
    .in('id', duplicateIds)
  if (deleteError) {
    throw new Error(`Erro ao remover duplicidades dos aparelhos vendidos: ${deleteError.message}`)
  }
}

function buildResaleDeviceLabel (device: {
  id: string
  device_name: string | null
  model: string | null
}) {
  const deviceName = String(device.device_name || '').trim()
  const model = String(device.model || '').trim()
  if (deviceName) return deviceName
  if (model) return model
  return `Aparelho vendido #${device.id.slice(0, 8)}`
}

/** Remove lançamentos financeiros vinculados ao pedido (mantém a venda). */
export async function clearSalesOrderFinancialTransactions ({
  supabase,
  orderId,
}: {
  supabase: SupabaseClient
  orderId: string
}) {
  const financeSupabase = getFinanceWriteClient(supabase)
  const { error: deleteError } = await financeSupabase
    .from('financial_transactions')
    .delete()
    .eq('sales_order_id', orderId)
  if (deleteError) {
    throw new Error(`Erro ao estornar lançamentos financeiros do pedido: ${deleteError.message}`)
  }
}

/** Pedidos com ao menos um lançamento financeiro ativo vinculado. */
export async function mapSalesOrdersWithFinancePosted (
  supabase: SupabaseClient,
  organizationId: string,
  orderIds: string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Set()

  const financeSupabase = getFinanceWriteClient(supabase)
  const { data, error } = await financeSupabase
    .from('financial_transactions')
    .select('sales_order_id')
    .eq('organization_id', organizationId)
    .in('sales_order_id', uniqueIds)

  if (error) {
    console.error('[mapSalesOrdersWithFinancePosted] failed', error)
    return new Set()
  }

  const posted = new Set<string>()
  for (const row of data ?? []) {
    const id = String((row as { sales_order_id?: string | null }).sales_order_id || '')
    if (id) posted.add(id)
  }
  return posted
}

export async function syncSalesOrderFinancialTransactions ({
  supabase,
  organizationId,
  orderId,
  orderRow,
}: {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
  orderRow?: SalesOrderFinanceRow
}) {
  const order = orderRow ?? await fetchSalesOrderForSync({ supabase, organizationId, orderId })
  if (!order) return

  const financeSupabase = getFinanceWriteClient(supabase)

  if (order.status !== 'paid') {
    const { error: deleteError } = await financeSupabase
      .from('financial_transactions')
      .delete()
      .eq('sales_order_id', order.id)
    if (deleteError) {
      throw new Error(`Erro ao limpar transações financeiras antigas do pedido: ${deleteError.message}`)
    }
    return
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('sales_order_payments')
    .select('id, payment_method_id, payment_method_type, amount_cents, status, created_at')
    .eq('organization_id', organizationId)
    .eq('sales_order_id', order.id)
  if (paymentsError) {
    throw new Error(`Erro ao buscar pagamentos do pedido de venda: ${paymentsError.message}`)
  }

  const paidPayments = (payments ?? []).filter((p) => {
    const row = p as { status?: string | null, amount_cents?: number | null }
    return (row.status ?? 'paid') !== 'canceled' && Math.max(0, Number(row.amount_cents) || 0) > 0
  }) as SalesOrderPaymentFinanceRow[]

  const changeCents = Math.max(0, Number(order.change_cents) || 0)
  const totalCents = Math.max(0, Number(order.total_cents) || 0)
  const netPayments = netSalesOrderPaymentAmounts(paidPayments, changeCents, totalCents)

  const [methods, defaultContaId, existingFinance] = await Promise.all([
    loadOrganizationPaymentMethods(supabase, organizationId),
    loadDefaultContaId(supabase, organizationId),
    financeSupabase
      .from('financial_transactions')
      .select('id, occurred_at')
      .eq('sales_order_id', order.id)
      .order('occurred_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (existingFinance.error) {
    throw new Error(`Erro ao carregar lançamentos financeiros do pedido: ${existingFinance.error.message}`)
  }

  const preservedOccurredAt = existingFinance.data?.occurred_at
    ? String(existingFinance.data.occurred_at)
    : null

  const rows = netPayments
    .map((payment) => {
      const { contaId, label } = resolveContaForSalesOrderPayment(payment, methods, defaultContaId)
      if (!contaId) return null
      const occurredAt = preservedOccurredAt
        || toSaoPauloDate(payment.created_at || order.updated_at || new Date().toISOString())
      return {
        organization_id: organizationId,
        conta_id: contaId,
        amount_cents: Math.max(0, Number(payment.amount_cents) || 0),
        type: 'entrada' as const,
        occurred_at: occurredAt,
        sales_order_id: order.id,
        description: `Pedido #${order.order_number ?? order.id.slice(0, 8)} - ${label}`,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (paidPayments.length > 0 && netPayments.length > 0 && rows.length === 0) {
    throw new Error(
      'Nenhuma carteira vinculada às formas de pagamento. Configure em Financeiro > Formas de pagamento ou crie uma carteira.',
    )
  }

  const { error: deleteError } = await financeSupabase
    .from('financial_transactions')
    .delete()
    .eq('sales_order_id', order.id)
  if (deleteError) {
    throw new Error(`Erro ao limpar transações financeiras antigas do pedido: ${deleteError.message}`)
  }

  if (rows.length === 0) return

  const { error: insertError } = await financeSupabase
    .from('financial_transactions')
    .insert(rows)
  if (insertError) {
    throw new Error(`Erro ao inserir transações financeiras do pedido: ${insertError.message}`)
  }

  await dedupeSalesOrderFinancialTransactions({
    supabase: financeSupabase,
    orderId: order.id,
  })
}

async function fetchSalesOrderForSync ({
  supabase,
  organizationId,
  orderId,
}: {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
}) {
  const { data, error } = await supabase
    .from('sales_orders')
    .select('id, organization_id, order_number, status, updated_at, change_cents, total_cents')
    .eq('organization_id', organizationId)
    .eq('id', orderId)
    .maybeSingle()
  if (error) {
    throw new Error(`Erro ao carregar pedido para sincronização financeira: ${error.message}`)
  }
  return (data ?? null) as SalesOrderFinanceRow | null
}

async function syncAllSalesOrdersByOrganization ({
  supabase,
  organizationId,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  pageSize: number
}) {
  let from = 0
  let syncedSalesOrders = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('sales_orders')
      .select('id, organization_id, order_number, status, updated_at, change_cents, total_cents')
      .eq('organization_id', organizationId)
      .eq('status', 'paid')
      .range(from, to)
      .order('updated_at', { ascending: false })
    if (error) {
      throw new Error(`Erro ao carregar pedidos de venda para backfill financeiro: ${error.message}`)
    }
    const rows = (data ?? []) as SalesOrderFinanceRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      await syncSalesOrderFinancialTransactions({
        supabase,
        organizationId,
        orderId: row.id,
        orderRow: row,
      })
      syncedSalesOrders += 1
    }
    if (rows.length < pageSize) break
    from += pageSize
  }

  return { syncedSalesOrders }
}

async function syncSalesOrdersByPeriod ({
  supabase,
  organizationId,
  fromIso,
  toIso,
  pageSize,
}: {
  supabase: SupabaseClient
  organizationId: string
  fromIso: string
  toIso: string
  pageSize: number
}) {
  const orderIds = new Set<string>()

  const { data: paymentRows, error: paymentsError } = await supabase
    .from('sales_order_payments')
    .select('sales_order_id')
    .eq('organization_id', organizationId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  if (paymentsError) {
    throw new Error(`Erro ao buscar pagamentos de pedidos no período: ${paymentsError.message}`)
  }
  for (const row of paymentRows ?? []) {
    const id = String((row as { sales_order_id?: string }).sales_order_id || '')
    if (id) orderIds.add(id)
  }

  const ids = Array.from(orderIds)
  if (ids.length === 0) return { syncedSalesOrders: 0 }

  let syncedSalesOrders = 0
  for (let i = 0; i < ids.length; i += pageSize) {
    const chunk = ids.slice(i, i + pageSize)
    const { data, error } = await supabase
      .from('sales_orders')
      .select('id, organization_id, order_number, status, updated_at, change_cents, total_cents')
      .eq('organization_id', organizationId)
      .eq('status', 'paid')
      .in('id', chunk)
    if (error) {
      throw new Error(`Erro ao carregar pedidos de venda no período: ${error.message}`)
    }
    for (const row of (data ?? []) as SalesOrderFinanceRow[]) {
      await syncSalesOrderFinancialTransactions({
        supabase,
        organizationId,
        orderId: row.id,
        orderRow: row,
      })
      syncedSalesOrders += 1
    }
  }

  return { syncedSalesOrders }
}

async function dedupeSalesOrderFinancialTransactions ({
  supabase,
  orderId,
}: {
  supabase: SupabaseClient
  orderId: string
}) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, conta_id, amount_cents, type, occurred_at, description')
    .eq('sales_order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Erro ao deduplicar transações financeiras do pedido: ${error.message}`)
  }
  const rows = (data ?? []) as Array<{
    id: string
    conta_id: string
    amount_cents: number
    type: string
    occurred_at: string
    description: string | null
  }>
  if (rows.length <= 1) return
  const seen = new Set<string>()
  const duplicateIds: string[] = []
  for (const row of rows) {
    const key = [row.conta_id, row.amount_cents, row.type, row.occurred_at, row.description ?? ''].join('|')
    if (seen.has(key)) duplicateIds.push(row.id)
    else seen.add(key)
  }
  if (duplicateIds.length === 0) return
  const { error: deleteError } = await supabase
    .from('financial_transactions')
    .delete()
    .in('id', duplicateIds)
  if (deleteError) {
    throw new Error(`Erro ao remover duplicidades do pedido: ${deleteError.message}`)
  }
}

function getFinanceWriteClient (fallback: SupabaseClient) {
  try {
    return createSupabaseServiceClient()
  } catch {
    return fallback
  }
}

async function fetchOrderForSync ({
  supabase,
  orderId,
  organizationId,
}: {
  supabase: SupabaseClient
  orderId: string
  organizationId: string
}) {
  const { data, error } = await supabase
    .from('service_orders')
    .select('id, organization_id, display_number, payment_methods, closed_at, updated_at')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) {
    throw new Error(`Erro ao carregar OS para sincronização financeira: ${error.message}`)
  }
  return (data ?? null) as ServiceOrderFinanceRow | null
}

export const __private__ = {
  parsePaymentMethodsForFinance,
  buildOccurredAt,
  toSaoPauloDate,
  toSaoPauloIsoStart,
  toSaoPauloIsoEnd,
  netSalesOrderPaymentAmounts,
}

async function dedupeServiceOrderFinancialTransactions ({
  supabase,
  orderId,
}: {
  supabase: SupabaseClient
  orderId: string
}) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('id, conta_id, amount_cents, type, occurred_at, description, created_at')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao deduplicar transações da OS: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    id: string
    conta_id: string
    amount_cents: number
    type: string
    occurred_at: string
    description: string | null
    created_at: string
  }>

  if (rows.length <= 1) return

  const keepByKey = new Set<string>()
  const duplicateIds: string[] = []

  for (const row of rows) {
    const key = [
      row.conta_id,
      row.amount_cents,
      row.type,
      row.occurred_at,
      row.description ?? '',
    ].join('|')
    if (keepByKey.has(key)) {
      duplicateIds.push(row.id)
      continue
    }
    keepByKey.add(key)
  }

  if (duplicateIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('financial_transactions')
    .delete()
    .in('id', duplicateIds)

  if (deleteError) {
    throw new Error(`Erro ao remover duplicidades de transações da OS: ${deleteError.message}`)
  }
}
