import type { SupabaseClient } from '@supabase/supabase-js'
import { getOpenCashSession } from '@/lib/pdv/service'
import { syncSalesOrderFinancialTransactions } from '@/lib/finance/service-order-financial-sync'

export type SalesOrderItemInput = {
  product_id: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents?: number
  discount_cents?: number
}

export type SalesOrderPaymentInput = {
  payment_method_id?: string | null
  payment_method_type: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'
  amount_cents: number
  status?: 'pending' | 'paid' | 'canceled'
  metadata?: Record<string, unknown> | null
}

export type SalesOrderDraftInput = {
  customer_name?: string | null
  customer_type?: 'pf' | 'pj' | null
  customer_document?: string | null
  discount_total_cents?: number
}

type AuthCtx = {
  organizationId: string
  userId: string
  supabase: SupabaseClient
}

function toInt (value: unknown, min = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.round(n))
}

export function calcItemSubtotal (item: SalesOrderItemInput) {
  const quantity = toInt(item.quantity, 0)
  const unitPrice = toInt(item.unit_price_cents, 0)
  const discount = toInt(item.discount_cents ?? 0, 0)
  const raw = quantity * unitPrice
  return Math.max(0, raw - discount)
}

export function calcSalesOrderTotals (items: SalesOrderItemInput[], discountTotalCents = 0) {
  const subtotal = items.reduce((acc, item) => acc + calcItemSubtotal(item), 0)
  const discountTotal = toInt(discountTotalCents, 0)
  const total = Math.max(0, subtotal - discountTotal)
  return {
    subtotalCents: subtotal,
    discountTotalCents: discountTotal,
    totalCents: total,
  }
}

async function updateOrderTotals (auth: AuthCtx, orderId: string, items: SalesOrderItemInput[], discountTotalCents: number) {
  const totals = calcSalesOrderTotals(items, discountTotalCents)
  const { error } = await auth.supabase
    .from('sales_orders')
    .update({
      subtotal_cents: totals.subtotalCents,
      discount_total_cents: totals.discountTotalCents,
      total_cents: totals.totalCents,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (error) return { ok: false as const, error: 'db_error' as const }
  return { ok: true as const, totals }
}

export async function createSalesOrder (
  auth: AuthCtx,
  items: SalesOrderItemInput[],
  draft: SalesOrderDraftInput = {},
): Promise<
  | { ok: true, orderId: string }
  | { ok: false, error: 'db_error' | 'cash_not_open' }
> {
  const session = await getOpenCashSession(auth)
  if (!session.ok) {
    return { ok: false, error: session.error === 'cash_not_open' ? 'cash_not_open' : 'db_error' }
  }

  const discountTotalCents = toInt(draft.discount_total_cents ?? 0, 0)
  const totals = calcSalesOrderTotals(items, discountTotalCents)

  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .insert({
      organization_id: auth.organizationId,
      cash_session_id: session.session.id,
      status: 'in_progress',
      seller_user_id: auth.userId,
      customer_name: draft.customer_name ?? 'Consumidor Final',
      customer_type: draft.customer_type ?? 'pf',
      customer_document: draft.customer_document ?? null,
      subtotal_cents: totals.subtotalCents,
      discount_total_cents: totals.discountTotalCents,
      total_cents: totals.totalCents,
      paid_amount_cents: 0,
      change_cents: 0,
    })
    .select('id')
    .single()

  if (orderError || !order) return { ok: false as const, error: 'db_error' as const }

  if (items.length > 0) {
    const replace = await replaceSalesOrderItems(auth, order.id, items)
    if (!replace.ok) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const, orderId: order.id }
}

export async function updateSalesOrderDraft (
  auth: AuthCtx,
  orderId: string,
  draft: SalesOrderDraftInput,
  items?: SalesOrderItemInput[],
) {
  const { data: existing, error: loadError } = await auth.supabase
    .from('sales_orders')
    .select('id, status, discount_total_cents')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (loadError) return { ok: false as const, error: 'db_error' as const }
  if (!existing) return { ok: false as const, error: 'not_found' as const }
  if (existing.status !== 'in_progress') return { ok: false as const, error: 'order_not_editable' as const }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (draft.customer_name !== undefined) patch.customer_name = draft.customer_name
  if (draft.customer_type !== undefined) patch.customer_type = draft.customer_type
  if (draft.customer_document !== undefined) patch.customer_document = draft.customer_document

  const discountTotalCents = draft.discount_total_cents !== undefined
    ? toInt(draft.discount_total_cents, 0)
    : toInt(existing.discount_total_cents, 0)

  if (draft.discount_total_cents !== undefined) {
    patch.discount_total_cents = discountTotalCents
  }

  const { error: updError } = await auth.supabase
    .from('sales_orders')
    .update(patch)
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (updError) return { ok: false as const, error: 'db_error' as const }

  if (items) {
    const replace = await replaceSalesOrderItems(auth, orderId, items)
    if (!replace.ok) return replace
    const totals = await updateOrderTotals(auth, orderId, items, discountTotalCents)
    if (!totals.ok) return totals
  } else if (draft.discount_total_cents !== undefined) {
    const itemsRes = await listSalesOrderItems(auth, orderId)
    if (!itemsRes.ok) return itemsRes
    const itemInputs: SalesOrderItemInput[] = itemsRes.items.map((row) => ({
      product_id: String(row.product_id),
      quantity: toInt(row.quantity, 1),
      unit_price_cents: toInt(row.unit_price_cents, 0),
      unit_cost_cents: toInt(row.unit_cost_cents ?? 0, 0),
      discount_cents: toInt(row.discount_cents ?? 0, 0),
    }))
    const totals = await updateOrderTotals(auth, orderId, itemInputs, discountTotalCents)
    if (!totals.ok) return totals
  }

  return { ok: true as const }
}

export async function listSalesOrderItems (auth: AuthCtx, orderId: string) {
  const { data, error } = await auth.supabase
    .from('sales_order_items')
    .select('id, product_id, quantity, unit_price_cents, unit_cost_cents, discount_cents, subtotal_cents')
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) return { ok: false as const, error: 'db_error' as const }
  return { ok: true as const, items: data ?? [] }
}

export async function replaceSalesOrderItems (auth: AuthCtx, orderId: string, items: SalesOrderItemInput[]) {
  const { error: delError } = await auth.supabase
    .from('sales_order_items')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)

  if (delError) return { ok: false as const, error: 'db_error' as const }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      organization_id: auth.organizationId,
      sales_order_id: orderId,
      product_id: item.product_id,
      quantity: toInt(item.quantity, 1),
      unit_price_cents: toInt(item.unit_price_cents, 0),
      unit_cost_cents: toInt(item.unit_cost_cents ?? 0, 0),
      discount_cents: toInt(item.discount_cents ?? 0, 0),
      subtotal_cents: calcItemSubtotal(item),
    }))
    const { error: insError } = await auth.supabase.from('sales_order_items').insert(rows)
    if (insError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function replaceSalesOrderPayments (auth: AuthCtx, orderId: string, payments: SalesOrderPaymentInput[]) {
  const { error: delError } = await auth.supabase
    .from('sales_order_payments')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)

  if (delError) return { ok: false as const, error: 'db_error' as const }

  if (payments.length > 0) {
    const rows = payments.map((payment) => ({
      organization_id: auth.organizationId,
      sales_order_id: orderId,
      payment_method_id: payment.payment_method_id ?? null,
      payment_method_type: payment.payment_method_type,
      amount_cents: toInt(payment.amount_cents, 1),
      status: payment.status ?? 'paid',
      metadata: payment.metadata ?? null,
    }))
    const { error: insError } = await auth.supabase.from('sales_order_payments').insert(rows)
    if (insError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function loadSalesOrder (auth: AuthCtx, orderId: string) {
  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, seller_user_id, customer_name, customer_type, customer_document, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, created_at, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) return { ok: false as const, error: 'db_error' as const }
  if (!order) return { ok: false as const, error: 'not_found' as const }

  const [items, payments] = await Promise.all([
    auth.supabase
      .from('sales_order_items')
      .select('id, product_id, quantity, unit_price_cents, unit_cost_cents, discount_cents, subtotal_cents, products(id, name, sku, barcode, image_url)')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    auth.supabase
      .from('sales_order_payments')
      .select('id, payment_method_id, payment_method_type, amount_cents, status, metadata')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
  ])

  if (items.error || payments.error) return { ok: false as const, error: 'db_error' as const }

  return {
    ok: true as const,
    order,
    items: items.data ?? [],
    payments: payments.data ?? [],
  }
}

async function ensureStockAvailable (auth: AuthCtx, orderId: string) {
  const itemsRes = await listSalesOrderItems(auth, orderId)
  if (!itemsRes.ok) return itemsRes
  if (itemsRes.items.length === 0) return { ok: false as const, error: 'empty_order' as const }

  const productIds = itemsRes.items.map((item) => String(item.product_id))
  const { data, error } = await auth.supabase.rpc('portal_products_list_stock_summary', {
    p_product_ids: productIds,
  })
  if (error) return { ok: false as const, error: 'db_error' as const }

  const stockById = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ product_id: string, current_stock: number | string }>) {
    const raw = row.current_stock
    const stock = typeof raw === 'number' ? raw : Number(raw)
    stockById.set(String(row.product_id), Number.isFinite(stock) ? stock : 0)
  }

  for (const item of itemsRes.items) {
    const pid = String(item.product_id)
    const qty = toInt(item.quantity, 0)
    const stock = stockById.get(pid) ?? 0
    if (stock < qty) {
      return { ok: false as const, error: 'stock_unavailable' as const, productId: pid, requested: qty, available: stock }
    }
  }

  return { ok: true as const, items: itemsRes.items }
}

export async function finalizeSalesOrder (auth: AuthCtx, orderId: string) {
  const orderData = await loadSalesOrder(auth, orderId)
  if (!orderData.ok) return orderData
  if (orderData.order.status === 'paid') return { ok: true as const, order: orderData.order }
  if (orderData.order.status === 'canceled') return { ok: false as const, error: 'order_canceled' as const }

  const stock = await ensureStockAvailable(auth, orderId)
  if (!stock.ok) return stock

  const paidAmount = orderData.payments.reduce((acc, p) => acc + toInt(p.amount_cents, 0), 0)
  const total = toInt(orderData.order.total_cents, 0)
  if (paidAmount < total) return { ok: false as const, error: 'payment_insufficient' as const }

  const hasCash = orderData.payments.some((p) => p.payment_method_type === 'dinheiro')
  const change = hasCash ? Math.max(0, paidAmount - total) : 0

  for (const item of stock.items) {
    const quantity = toInt(item.quantity, 1)
    const unitCost = toInt(item.unit_cost_cents ?? 0, 0)
    const ref = `sales_order:${orderId}:item:${item.id}`
    const { error: movError } = await auth.supabase
      .from('product_stock_movements')
      .insert({
        organization_id: auth.organizationId,
        product_id: item.product_id,
        type: 'exit',
        quantity,
        unit_value_cents: unitCost,
        total_value_cents: unitCost * quantity,
        source: 'sales_order',
        external_reference: ref,
        created_by: auth.userId,
      })
    if (movError) return { ok: false as const, error: 'db_error' as const }
  }

  const { error: updError } = await auth.supabase
    .from('sales_orders')
    .update({
      status: 'paid',
      paid_amount_cents: paidAmount,
      change_cents: change,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (updError) return { ok: false as const, error: 'db_error' as const }

  try {
    await syncSalesOrderFinancialTransactions({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      orderId,
    })
  } catch {
    return { ok: false as const, error: 'db_error' as const }
  }

  return {
    ok: true as const,
    order: {
      ...orderData.order,
      status: 'paid',
      paid_amount_cents: paidAmount,
      change_cents: change,
    },
  }
}

export async function cancelSalesOrder (auth: AuthCtx, orderId: string, reason?: string | null) {
  const { data: existing, error: loadError } = await auth.supabase
    .from('sales_orders')
    .select('id, status')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (loadError) return { ok: false as const, error: 'db_error' as const }
  if (!existing) return { ok: false as const, error: 'not_found' as const }
  if (existing.status !== 'in_progress') return { ok: false as const, error: 'order_not_editable' as const }

  const { error } = await auth.supabase
    .from('sales_orders')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_by: auth.userId,
      cancel_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (error) return { ok: false as const, error: 'db_error' as const }
  return { ok: true as const }
}
