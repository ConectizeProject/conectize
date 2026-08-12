import type { SupabaseClient } from '@supabase/supabase-js'
import { getOpenCashSession } from '@/lib/pdv/service'
import {
  clearSalesOrderFinancialTransactions,
  mapSalesOrdersWithFinancePosted,
  syncSalesOrderFinancialTransactions,
} from '@/lib/finance/service-order-financial-sync'

export { mapSalesOrdersWithFinancePosted }
import { toDbCustomerType } from '@/lib/sales-orders/customer-type'

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
  installments?: number
  metadata?: Record<string, unknown> | null
}

export type SalesOrderDraftInput = {
  customer_name?: string | null
  customer_type?: 'pf' | 'pj' | null
  customer_document?: string | null
  discount_total_cents?: number
  surcharge_cents?: number
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

type SalesOrderStockItem = {
  id?: string
  product_id: string
  quantity: number
  unit_cost_cents?: number | null
}

type SalesOrderStockNetRow = {
  product_id: string
  net_exit: number
  unit_value_cents: number
}

async function insertSalesOrderStockMovement (
  auth: AuthCtx,
  input: {
    orderId: string
    productId: string
    type: 'entry' | 'exit'
    quantity: number
    unitValueCents: number
    externalReference: string
  },
) {
  const quantity = Math.max(1, toInt(input.quantity, 1))
  const unitValueCents = toInt(input.unitValueCents, 0)
  const { error } = await auth.supabase
    .from('product_stock_movements')
    .insert({
      organization_id: auth.organizationId,
      product_id: input.productId,
      type: input.type,
      quantity,
      unit_value_cents: unitValueCents,
      total_value_cents: unitValueCents * quantity,
      source: 'sales_order',
      external_reference: input.externalReference,
      sales_order_id: input.orderId,
      created_by: auth.userId,
    })

  if (error) return { ok: false as const, error: 'db_error' as const }
  return { ok: true as const }
}

async function loadSalesOrderStockNets (
  auth: AuthCtx,
  orderId: string,
): Promise<{ ok: true, rows: SalesOrderStockNetRow[] } | { ok: false, error: 'db_error' }> {
  const { data, error } = await auth.supabase
    .from('product_stock_movements')
    .select('product_id, type, quantity, unit_value_cents')
    .eq('organization_id', auth.organizationId)
    .eq('source', 'sales_order')
    .eq('sales_order_id', orderId)

  if (error) return { ok: false as const, error: 'db_error' as const }

  const byProduct = new Map<string, SalesOrderStockNetRow>()
  for (const row of data ?? []) {
    const productId = String(row.product_id || '')
    if (!productId) continue
    const quantity = toInt(row.quantity, 0)
    if (quantity <= 0) continue
    const current = byProduct.get(productId) ?? {
      product_id: productId,
      net_exit: 0,
      unit_value_cents: toInt(row.unit_value_cents, 0),
    }
    if (row.type === 'exit') current.net_exit += quantity
    else if (row.type === 'entry') current.net_exit -= quantity
    if (toInt(row.unit_value_cents, 0) > 0) {
      current.unit_value_cents = toInt(row.unit_value_cents, 0)
    }
    byProduct.set(productId, current)
  }

  return {
    ok: true as const,
    rows: [...byProduct.values()].filter((row) => row.net_exit > 0),
  }
}

/** Retorna os IDs de vendas com baixa de estoque ainda efetiva (saídas líquidas > 0). */
export async function mapSalesOrdersWithStockPosted (
  auth: AuthCtx,
  orderIds: string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Set()

  const { data, error } = await auth.supabase
    .from('product_stock_movements')
    .select('sales_order_id, type, quantity')
    .eq('organization_id', auth.organizationId)
    .eq('source', 'sales_order')
    .in('sales_order_id', uniqueIds)

  if (error) {
    console.error('[mapSalesOrdersWithStockPosted] failed', error)
    return new Set()
  }

  const netByOrder = new Map<string, number>()
  for (const row of data ?? []) {
    const orderId = String(row.sales_order_id || '')
    if (!orderId) continue
    const quantity = toInt(row.quantity, 0)
    if (quantity <= 0) continue
    const current = netByOrder.get(orderId) ?? 0
    if (row.type === 'exit') netByOrder.set(orderId, current + quantity)
    else if (row.type === 'entry') netByOrder.set(orderId, current - quantity)
  }

  const posted = new Set<string>()
  for (const [orderId, net] of netByOrder.entries()) {
    if (net > 0) posted.add(orderId)
  }
  return posted
}

async function applySalesOrderStockExits (
  auth: AuthCtx,
  orderId: string,
  items: SalesOrderStockItem[],
) {
  for (const item of items) {
    const itemId = String(item.id || '')
    if (!itemId) return { ok: false as const, error: 'db_error' as const }
    const quantity = toInt(item.quantity, 1)
    const unitCost = toInt(item.unit_cost_cents ?? 0, 0)
    const ref = `sales_order:${orderId}:item:${itemId}`
    const inserted = await insertSalesOrderStockMovement(auth, {
      orderId,
      productId: item.product_id,
      type: 'exit',
      quantity,
      unitValueCents: unitCost,
      externalReference: ref,
    })
    if (!inserted.ok) return { ok: false as const, error: 'stock_apply_failed' as const }
  }
  return { ok: true as const }
}

async function reverseSalesOrderStockNets (
  auth: AuthCtx,
  orderId: string,
  reason: 'cancel' | 'manual' | 'edit',
  editToken?: number,
) {
  const nets = await loadSalesOrderStockNets(auth, orderId)
  if (!nets.ok) return { ok: false as const, error: 'db_error' as const, hadReversal: false }

  let hadReversal = false
  const token = editToken ?? Date.now()
  for (const row of nets.rows) {
    const quantity = row.net_exit
    if (quantity <= 0) continue

    const externalReference = reason === 'cancel'
      ? `sales_order_cancel:${orderId}:product:${row.product_id}:${token}`
      : reason === 'edit'
        ? `sales_order_edit_rev:${orderId}:product:${row.product_id}:${token}`
        : `sales_order_stock_reverse:${orderId}:product:${row.product_id}:${token}`

    const inserted = await insertSalesOrderStockMovement(auth, {
      orderId,
      productId: row.product_id,
      type: 'entry',
      quantity,
      unitValueCents: row.unit_value_cents,
      externalReference,
    })
    if (!inserted.ok) {
      return { ok: false as const, error: 'stock_reverse_failed' as const, hadReversal }
    }
    hadReversal = true
  }

  return { ok: true as const, hadReversal }
}

export function calcItemSubtotal (item: SalesOrderItemInput) {
  const quantity = toInt(item.quantity, 0)
  const unitPrice = toInt(item.unit_price_cents, 0)
  const discount = toInt(item.discount_cents ?? 0, 0)
  const raw = quantity * unitPrice
  return Math.max(0, raw - discount)
}

async function assertProductsBelongToOrganization (
  auth: AuthCtx,
  productIds: string[],
) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueIds.length === 0) return { ok: true as const }

  const { data, error } = await auth.supabase
    .from('products')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .in('id', uniqueIds)

  if (error) return { ok: false as const, error: 'db_error' as const }
  if ((data?.length ?? 0) !== uniqueIds.length) {
    return { ok: false as const, error: 'invalid_product' as const }
  }
  return { ok: true as const }
}

export function calcSalesOrderTotals (
  items: SalesOrderItemInput[],
  discountTotalCents = 0,
  surchargeCents = 0,
) {
  const subtotal = items.reduce((acc, item) => acc + calcItemSubtotal(item), 0)
  const discountTotal = Math.min(subtotal, toInt(discountTotalCents, 0))
  const surcharge = toInt(surchargeCents, 0)
  // Desconto só sobre o subtotal dos itens; cobrança adicional entra integral no total.
  const total = Math.max(0, subtotal - discountTotal) + surcharge
  return {
    subtotalCents: subtotal,
    discountTotalCents: discountTotal,
    surchargeCents: surcharge,
    totalCents: total,
  }
}

async function updateOrderTotals (
  auth: AuthCtx,
  orderId: string,
  items: SalesOrderItemInput[],
  discountTotalCents: number,
  surchargeCents: number,
) {
  const totals = calcSalesOrderTotals(items, discountTotalCents, surchargeCents)
  const { error } = await auth.supabase
    .from('sales_orders')
    .update({
      subtotal_cents: totals.subtotalCents,
      discount_total_cents: totals.discountTotalCents,
      surcharge_cents: totals.surchargeCents,
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
  | { ok: false, error: 'db_error' | 'cash_not_open' | 'invalid_product' }
> {
  const session = await getOpenCashSession(auth)
  if (!session.ok) {
    return { ok: false, error: session.error === 'cash_not_open' ? 'cash_not_open' : 'db_error' }
  }

  const discountTotalCents = toInt(draft.discount_total_cents ?? 0, 0)
  const surchargeCents = toInt(draft.surcharge_cents ?? 0, 0)
  const totals = calcSalesOrderTotals(items, discountTotalCents, surchargeCents)

  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .insert({
      organization_id: auth.organizationId,
      cash_session_id: session.session.id,
      status: 'in_progress',
      seller_user_id: auth.userId,
      customer_name: draft.customer_name ?? 'Consumidor Final',
      customer_type: toDbCustomerType(draft.customer_type ?? 'pf'),
      customer_document: draft.customer_document ?? null,
      subtotal_cents: totals.subtotalCents,
      discount_total_cents: totals.discountTotalCents,
      surcharge_cents: totals.surchargeCents,
      total_cents: totals.totalCents,
      paid_amount_cents: 0,
      change_cents: 0,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('[createSalesOrder] insert sales_orders failed', orderError)
    return { ok: false as const, error: 'db_error' as const }
  }

  if (items.length > 0) {
    const replace = await replaceSalesOrderItems(auth, order.id, items)
    if (!replace.ok) {
      await auth.supabase
        .from('sales_orders')
        .delete()
        .eq('organization_id', auth.organizationId)
        .eq('id', order.id)
      return { ok: false as const, error: replace.error }
    }
  }

  return { ok: true as const, orderId: order.id }
}

export async function updateSalesOrderDraft (
  auth: AuthCtx,
  orderId: string,
  draft: SalesOrderDraftInput,
  items?: SalesOrderItemInput[],
  payments?: SalesOrderPaymentInput[],
) {
  const { data: existing, error: loadError } = await auth.supabase
    .from('sales_orders')
    .select('id, status, order_number, discount_total_cents, surcharge_cents, paid_amount_cents, change_cents, total_cents')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (loadError) return { ok: false as const, error: 'db_error' as const }
  if (!existing) return { ok: false as const, error: 'not_found' as const }
  if (existing.status !== 'in_progress' && existing.status !== 'paid') {
    return { ok: false as const, error: 'order_not_editable' as const }
  }

  const wasPaid = existing.status === 'paid'
  let previousItems: Array<{
    id: string
    product_id: string
    quantity: number
    unit_cost_cents: number | null
  }> = []

  const discountTotalCents = draft.discount_total_cents !== undefined
    ? toInt(draft.discount_total_cents, 0)
    : toInt(existing.discount_total_cents, 0)

  const surchargeCents = draft.surcharge_cents !== undefined
    ? toInt(draft.surcharge_cents, 0)
    : toInt(existing.surcharge_cents, 0)

  let nextItemInputs: SalesOrderItemInput[] | null = items ?? null
  if (!nextItemInputs && (wasPaid || payments)) {
    const currentItemsRes = await listSalesOrderItems(auth, orderId)
    if (!currentItemsRes.ok) return currentItemsRes
    nextItemInputs = currentItemsRes.items.map((row) => ({
      product_id: String(row.product_id),
      quantity: toInt(row.quantity, 1),
      unit_price_cents: toInt(row.unit_price_cents, 0),
      unit_cost_cents: toInt(row.unit_cost_cents ?? 0, 0),
      discount_cents: toInt(row.discount_cents ?? 0, 0),
    }))
  }

  const prospectivePaidAmount = payments
    ? payments.reduce((sum, payment) => sum + toInt(payment.amount_cents, 0), 0)
    : toInt(existing.paid_amount_cents, 0)

  if ((wasPaid || payments) && nextItemInputs) {
    const prospective = calcSalesOrderTotals(nextItemInputs, discountTotalCents, surchargeCents)
    if (prospectivePaidAmount < prospective.totalCents) {
      return { ok: false as const, error: 'payment_insufficient' as const }
    }
  }

  if (wasPaid && items) {
    const previousRes = await listSalesOrderItems(auth, orderId)
    if (!previousRes.ok) return previousRes
    previousItems = previousRes.items.map((row) => ({
      id: String(row.id),
      product_id: String(row.product_id),
      quantity: toInt(row.quantity, 1),
      unit_cost_cents: row.unit_cost_cents == null ? null : toInt(row.unit_cost_cents, 0),
    }))
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (draft.customer_name !== undefined) patch.customer_name = draft.customer_name
  if (draft.customer_type !== undefined) patch.customer_type = toDbCustomerType(draft.customer_type)
  if (draft.customer_document !== undefined) patch.customer_document = draft.customer_document

  if (draft.discount_total_cents !== undefined) {
    patch.discount_total_cents = discountTotalCents
  }
  if (draft.surcharge_cents !== undefined) {
    patch.surcharge_cents = surchargeCents
  }

  const { error: updError } = await auth.supabase
    .from('sales_orders')
    .update(patch)
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)

  if (updError) return { ok: false as const, error: 'db_error' as const }

  const shouldRecalcTotals = Boolean(items)
    || draft.discount_total_cents !== undefined
    || draft.surcharge_cents !== undefined

  if (items) {
    const replace = await replaceSalesOrderItems(auth, orderId, items)
    if (!replace.ok) return replace
    const totals = await updateOrderTotals(auth, orderId, items, discountTotalCents, surchargeCents)
    if (!totals.ok) return totals
  } else if (shouldRecalcTotals) {
    const itemsRes = await listSalesOrderItems(auth, orderId)
    if (!itemsRes.ok) return itemsRes
    const itemInputs: SalesOrderItemInput[] = itemsRes.items.map((row) => ({
      product_id: String(row.product_id),
      quantity: toInt(row.quantity, 1),
      unit_price_cents: toInt(row.unit_price_cents, 0),
      unit_cost_cents: toInt(row.unit_cost_cents ?? 0, 0),
      discount_cents: toInt(row.discount_cents ?? 0, 0),
    }))
    const totals = await updateOrderTotals(auth, orderId, itemInputs, discountTotalCents, surchargeCents)
    if (!totals.ok) return totals
  }

  if (payments) {
    const replacePayments = await replaceSalesOrderPayments(auth, orderId, payments)
    if (!replacePayments.ok) return replacePayments
  }

  if (wasPaid || payments) {
    const loaded = await loadSalesOrder(auth, orderId)
    if (!loaded.ok) return loaded

    const paidAmount = payments
      ? prospectivePaidAmount
      : toInt(loaded.order.paid_amount_cents, 0)
    const total = toInt(loaded.order.total_cents, 0)

    if (wasPaid && items && previousItems.length > 0) {
      const editToken = Date.now()
      const reversed = await reverseSalesOrderStockNets(auth, orderId, 'edit', editToken)
      if (!reversed.ok) {
        console.error('[updateSalesOrderDraft] stock reverse failed', reversed.error)
        return { ok: false as const, error: 'stock_reverse_failed' as const }
      }

      const applied = await applySalesOrderStockExits(auth, orderId, loaded.items)
      if (!applied.ok) {
        console.error('[updateSalesOrderDraft] stock apply failed', applied.error)
        return { ok: false as const, error: 'stock_apply_failed' as const }
      }
    }

    const hasCash = loaded.payments.some((payment) => payment.payment_method_type === 'dinheiro')
    const change = hasCash ? Math.max(0, paidAmount - total) : 0

    const paidPatch: Record<string, unknown> = {
      change_cents: change,
      updated_at: new Date().toISOString(),
    }
    if (payments) {
      paidPatch.paid_amount_cents = paidAmount
    }

    const { error: paidPatchError } = await auth.supabase
      .from('sales_orders')
      .update(paidPatch)
      .eq('organization_id', auth.organizationId)
      .eq('id', orderId)
    if (paidPatchError) return { ok: false as const, error: 'db_error' as const }

    // Pedido pago: qualquer alteração (principalmente pagamentos) re-sincroniza o financeiro
    // com as formas/carteiras atuais, mantendo o vínculo sales_order_id.
    if (wasPaid) {
      try {
        await syncSalesOrderFinancialTransactions({
          supabase: auth.supabase,
          organizationId: auth.organizationId,
          orderId,
          orderRow: {
            id: loaded.order.id,
            organization_id: auth.organizationId,
            order_number: loaded.order.order_number ?? null,
            status: 'paid',
            updated_at: new Date().toISOString(),
            change_cents: change,
            total_cents: total,
          },
        })
      } catch (err) {
        console.error('[updateSalesOrderDraft] finance sync failed', err)
        return { ok: false as const, error: 'finance_sync_failed' as const }
      }
    }
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
  const ownership = await assertProductsBelongToOrganization(
    auth,
    items.map((item) => item.product_id),
  )
  if (!ownership.ok) return ownership

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
      quantity: Math.max(1, toInt(item.quantity, 1)),
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
    const rows = payments.map((payment) => {
      const installments = Math.max(1, toInt(payment.installments ?? 1, 1))
      const baseMeta = payment.metadata && typeof payment.metadata === 'object'
        ? payment.metadata
        : {}
      return {
        organization_id: auth.organizationId,
        sales_order_id: orderId,
        payment_method_id: payment.payment_method_id ?? null,
        payment_method_type: payment.payment_method_type,
        amount_cents: toInt(payment.amount_cents, 1),
        status: payment.status ?? 'paid',
        metadata: {
          ...baseMeta,
          installments,
        },
      }
    })
    const { error: insError } = await auth.supabase.from('sales_order_payments').insert(rows)
    if (insError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function loadSalesOrder (auth: AuthCtx, orderId: string) {
  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, seller_user_id, customer_name, customer_type, customer_document, subtotal_cents, discount_total_cents, surcharge_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, bling_pedido_id, bling_nfce_id, bling_synced_at, bling_last_error, created_at, updated_at')
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

async function loadSalesOrderItemsForFinalize (auth: AuthCtx, orderId: string) {
  const itemsRes = await listSalesOrderItems(auth, orderId)
  if (!itemsRes.ok) return itemsRes
  if (itemsRes.items.length === 0) return { ok: false as const, error: 'empty_order' as const }
  return { ok: true as const, items: itemsRes.items }
}

export async function finalizeSalesOrder (
  auth: AuthCtx,
  orderId: string,
  options?: { change_cents?: number | null },
) {
  const orderData = await loadSalesOrder(auth, orderId)
  if (!orderData.ok) return orderData
  if (orderData.order.status === 'paid') return { ok: true as const, order: orderData.order }
  if (orderData.order.status === 'canceled') return { ok: false as const, error: 'order_canceled' as const }

  const itemsResult = await loadSalesOrderItemsForFinalize(auth, orderId)
  if (!itemsResult.ok) return itemsResult

  const paidAmount = orderData.payments.reduce((acc, p) => acc + toInt(p.amount_cents, 0), 0)
  const total = toInt(orderData.order.total_cents, 0)
  if (paidAmount < total) return { ok: false as const, error: 'payment_insufficient' as const }

  const hasCash = orderData.payments.some((p) => p.payment_method_type === 'dinheiro')
  let change = 0
  if (hasCash) {
    if (options?.change_cents != null && Number.isFinite(Number(options.change_cents))) {
      change = Math.max(0, Math.round(Number(options.change_cents)))
    } else {
      change = Math.max(0, paidAmount - total)
    }
  }

  const stockApplied = await applySalesOrderStockExits(auth, orderId, itemsResult.items)
  if (!stockApplied.ok) return { ok: false as const, error: 'db_error' as const }

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
      orderRow: {
        id: orderData.order.id,
        organization_id: auth.organizationId,
        order_number: orderData.order.order_number ?? null,
        status: 'paid',
        updated_at: new Date().toISOString(),
        change_cents: change,
        total_cents: total,
      },
    })
  } catch (err) {
    console.error('[finalizeSalesOrder] finance sync failed', err)
    return { ok: false as const, error: 'finance_sync_failed' as const }
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

/** Cria/atualiza rascunho + pagamentos + finaliza em uma única autenticação (checkout PDV). */
export async function checkoutSalesOrder (
  auth: AuthCtx,
  input: {
    orderId?: string | null
    items: SalesOrderItemInput[]
    draft?: SalesOrderDraftInput
    payments: SalesOrderPaymentInput[]
    change_cents?: number | null
  },
) {
  const items = input.items
  if (!items.length) {
    return { ok: false as const, error: 'empty_order' as const, orderId: null as string | null }
  }

  const draft = input.draft ?? {}
  let orderId = input.orderId ? String(input.orderId) : null

  if (!orderId) {
    const created = await createSalesOrder(auth, items, draft)
    if (created.ok === false) {
      return { ok: false as const, error: created.error, orderId: null as string | null }
    }
    orderId = created.orderId
  } else {
    const updated = await updateSalesOrderDraft(auth, orderId, draft, items)
    if (updated.ok === false) {
      return { ok: false as const, error: updated.error, orderId }
    }
  }

  const payResult = await replaceSalesOrderPayments(auth, orderId, input.payments)
  if (payResult.ok === false) {
    return { ok: false as const, error: payResult.error, orderId }
  }

  const finalized = await finalizeSalesOrder(auth, orderId, {
    change_cents: input.change_cents,
  })
  if (finalized.ok === false) {
    return {
      ok: false as const,
      error: finalized.error,
      orderId,
      details: finalized,
    }
  }

  if (!('order' in finalized)) {
    return { ok: false as const, error: 'unexpected_result' as const, orderId }
  }

  return { ok: true as const, orderId, order: finalized.order }
}

export async function cancelSalesOrder (
  auth: AuthCtx,
  orderId: string,
  reason?: string | null,
): Promise<
  | {
    ok: true
    blingWarning: string | null
    hadStockReversal: boolean
  }
  | { ok: false, error: string }
> {
  const { data: existing, error: loadError } = await auth.supabase
    .from('sales_orders')
    .select('id, status, order_number, bling_pedido_id, bling_nfce_id')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (loadError) return { ok: false as const, error: 'db_error' as const }
  if (!existing) return { ok: false as const, error: 'not_found' as const }
  if (existing.status === 'canceled') return { ok: false as const, error: 'already_canceled' as const }
  if (existing.status !== 'in_progress' && existing.status !== 'paid') {
    return { ok: false as const, error: 'order_not_cancellable' as const }
  }

  const wasPaid = existing.status === 'paid'
  if (wasPaid && !String(reason || '').trim()) {
    return { ok: false as const, error: 'cancel_reason_required' as const }
  }

  let hadStockReversal = false

  if (wasPaid) {
    const reversed = await reverseSalesOrderStockNets(auth, orderId, 'cancel')
    if (!reversed.ok) {
      console.error('[cancelSalesOrder] stock reverse failed', reversed.error)
      return { ok: false as const, error: 'stock_reverse_failed' as const }
    }
    hadStockReversal = reversed.hadReversal
  }

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

  if (wasPaid) {
    try {
      await syncSalesOrderFinancialTransactions({
        supabase: auth.supabase,
        organizationId: auth.organizationId,
        orderId,
        orderRow: {
          id: existing.id,
          organization_id: auth.organizationId,
          order_number: existing.order_number ?? null,
          status: 'canceled',
          updated_at: new Date().toISOString(),
          change_cents: 0,
          total_cents: 0,
        },
      })
    } catch (err) {
      console.error('[cancelSalesOrder] finance sync failed', err)
      return { ok: false as const, error: 'finance_sync_failed' as const }
    }
  }

  const blingWarning = existing.bling_pedido_id
    ? 'Pedido vinculado ao Bling. Estorne/cancele a nota ou o pedido no Bling manualmente, se necessário.'
    : null

  return {
    ok: true as const,
    blingWarning,
    hadStockReversal,
  }
}

async function assertPaidSalesOrder (auth: AuthCtx, orderId: string) {
  const { data: existing, error: loadError } = await auth.supabase
    .from('sales_orders')
    .select('id, status, order_number, change_cents, total_cents, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (loadError) return { ok: false as const, error: 'db_error' as const }
  if (!existing) return { ok: false as const, error: 'not_found' as const }
  if (existing.status !== 'paid') {
    return { ok: false as const, error: 'order_not_paid' as const }
  }
  return { ok: true as const, order: existing }
}

/** Lança baixa de estoque vinculada à venda (sem alterar status). */
export async function postSalesOrderStock (
  auth: AuthCtx,
  orderId: string,
): Promise<
  | { ok: true }
  | { ok: false, error: string }
> {
  const existing = await assertPaidSalesOrder(auth, orderId)
  if (!existing.ok) return { ok: false as const, error: existing.error }

  const nets = await loadSalesOrderStockNets(auth, orderId)
  if (!nets.ok) return { ok: false as const, error: 'db_error' as const }
  if (nets.rows.length > 0) {
    return { ok: false as const, error: 'stock_already_posted' as const }
  }

  const itemsRes = await listSalesOrderItems(auth, orderId)
  if (!itemsRes.ok) return { ok: false as const, error: 'db_error' as const }
  if (itemsRes.items.length === 0) {
    return { ok: false as const, error: 'empty_order' as const }
  }

  const applied = await applySalesOrderStockExits(auth, orderId, itemsRes.items)
  if (!applied.ok) return { ok: false as const, error: 'stock_apply_failed' as const }
  return { ok: true as const }
}

/** Estorna apenas a baixa de estoque vinculada à venda (sem cancelar a venda). */
export async function reverseSalesOrderStock (
  auth: AuthCtx,
  orderId: string,
): Promise<
  | { ok: true, hadReversal: boolean }
  | { ok: false, error: string }
> {
  const existing = await assertPaidSalesOrder(auth, orderId)
  if (!existing.ok) return { ok: false as const, error: existing.error }

  const nets = await loadSalesOrderStockNets(auth, orderId)
  if (!nets.ok) return { ok: false as const, error: 'db_error' as const }
  if (nets.rows.length === 0) {
    return { ok: false as const, error: 'stock_not_posted' as const }
  }

  const reversed = await reverseSalesOrderStockNets(auth, orderId, 'manual')
  if (!reversed.ok) return { ok: false as const, error: reversed.error }
  return { ok: true as const, hadReversal: reversed.hadReversal }
}

/** Lança o valor faturado no financeiro, vinculado à venda. */
export async function postSalesOrderFinance (
  auth: AuthCtx,
  orderId: string,
): Promise<
  | { ok: true }
  | { ok: false, error: string }
> {
  const existing = await assertPaidSalesOrder(auth, orderId)
  if (!existing.ok) return { ok: false as const, error: existing.error }

  const financePosted = await mapSalesOrdersWithFinancePosted(
    auth.supabase,
    auth.organizationId,
    [orderId],
  )
  if (financePosted.has(orderId)) {
    return { ok: false as const, error: 'finance_already_posted' as const }
  }

  try {
    await syncSalesOrderFinancialTransactions({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      orderId,
      orderRow: {
        id: existing.order.id,
        organization_id: auth.organizationId,
        order_number: existing.order.order_number ?? null,
        status: 'paid',
        updated_at: existing.order.updated_at ?? new Date().toISOString(),
        change_cents: toInt(existing.order.change_cents, 0),
        total_cents: toInt(existing.order.total_cents, 0),
      },
    })
  } catch (err) {
    console.error('[postSalesOrderFinance] failed', err)
    const message = err instanceof Error ? err.message : ''
    if (message.includes('carteira') || message.includes('formas de pagamento')) {
      return { ok: false as const, error: 'finance_wallet_missing' as const }
    }
    return { ok: false as const, error: 'finance_sync_failed' as const }
  }

  const confirmed = await mapSalesOrdersWithFinancePosted(
    auth.supabase,
    auth.organizationId,
    [orderId],
  )
  if (!confirmed.has(orderId)) {
    return { ok: false as const, error: 'finance_not_posted' as const }
  }
  return { ok: true as const }
}

/** Estorna o valor faturado no financeiro (sem cancelar a venda). */
export async function reverseSalesOrderFinance (
  auth: AuthCtx,
  orderId: string,
): Promise<
  | { ok: true }
  | { ok: false, error: string }
> {
  const existing = await assertPaidSalesOrder(auth, orderId)
  if (!existing.ok) return { ok: false as const, error: existing.error }

  const financePosted = await mapSalesOrdersWithFinancePosted(
    auth.supabase,
    auth.organizationId,
    [orderId],
  )
  if (!financePosted.has(orderId)) {
    return { ok: false as const, error: 'finance_not_posted' as const }
  }

  try {
    await clearSalesOrderFinancialTransactions({
      supabase: auth.supabase,
      orderId,
    })
  } catch (err) {
    console.error('[reverseSalesOrderFinance] failed', err)
    return { ok: false as const, error: 'finance_reverse_failed' as const }
  }

  return { ok: true as const }
}
