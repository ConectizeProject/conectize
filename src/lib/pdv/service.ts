import type { SupabaseClient } from '@supabase/supabase-js'
import { syncPdvSaleFinancialTransactions } from '@/lib/finance/service-order-financial-sync'

type SaleItemInput = {
  product_id: string
  quantity: number
  unit_price_cents: number
  discount_cents?: number
}

type SalePaymentInput = {
  payment_method_id?: string | null
  payment_method_type: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'
  amount_cents: number
  status?: 'pending' | 'paid' | 'canceled'
  metadata?: Record<string, unknown> | null
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

export function calcItemSubtotal (item: SaleItemInput) {
  const quantity = toInt(item.quantity, 0)
  const unitPrice = toInt(item.unit_price_cents, 0)
  const discount = toInt(item.discount_cents ?? 0, 0)
  const raw = quantity * unitPrice
  return Math.max(0, raw - discount)
}

export function calcSaleTotals (items: SaleItemInput[], discountTotalCents = 0) {
  const subtotal = items.reduce((acc, item) => acc + calcItemSubtotal(item), 0)
  const discountTotal = toInt(discountTotalCents, 0)
  const total = Math.max(0, subtotal - discountTotal)
  return {
    subtotalCents: subtotal,
    discountTotalCents: discountTotal,
    totalCents: total,
  }
}

export async function getOpenCashSession (auth: AuthCtx) {
  const { data, error } = await auth.supabase
    .from('pos_cash_sessions')
    .select('id, opened_by, opening_amount_cents, created_at')
    .eq('organization_id', auth.organizationId)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false as const, error: 'db_error' as const }
  if (!data) return { ok: false as const, error: 'cash_not_open' as const }
  return { ok: true as const, session: data }
}

export async function createPendingSale (
  auth: AuthCtx,
  items: SaleItemInput[],
  discountTotalCents = 0,
): Promise<
  | { ok: true, saleId: string }
  | { ok: false, error: 'db_error' | 'cash_not_open' }
> {
  const session = await getOpenCashSession(auth)
  if (!session.ok) {
    return { ok: false, error: session.error === 'cash_not_open' ? 'cash_not_open' : 'db_error' }
  }

  const totals = calcSaleTotals(items, discountTotalCents)
  const { data: sale, error: saleError } = await auth.supabase
    .from('pos_sales')
    .insert({
      organization_id: auth.organizationId,
      cash_session_id: session.session.id,
      status: 'pending',
      seller_user_id: auth.userId,
      subtotal_cents: totals.subtotalCents,
      discount_total_cents: totals.discountTotalCents,
      total_cents: totals.totalCents,
      paid_amount_cents: 0,
      change_cents: 0,
    })
    .select('id')
    .single()

  if (saleError || !sale) return { ok: false as const, error: 'db_error' as const }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      organization_id: auth.organizationId,
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: toInt(item.quantity, 1),
      unit_price_cents: toInt(item.unit_price_cents, 0),
      unit_cost_cents: 0,
      discount_cents: toInt(item.discount_cents ?? 0, 0),
      subtotal_cents: calcItemSubtotal(item),
    }))
    const { error: itemError } = await auth.supabase.from('pos_sale_items').insert(rows)
    if (itemError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const, saleId: sale.id }
}

export async function listSaleItems (auth: AuthCtx, saleId: string) {
  const { data, error } = await auth.supabase
    .from('pos_sale_items')
    .select('id, product_id, quantity, unit_price_cents, unit_cost_cents, discount_cents, subtotal_cents')
    .eq('organization_id', auth.organizationId)
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })

  if (error) return { ok: false as const, error: 'db_error' as const }
  return { ok: true as const, items: data ?? [] }
}

export async function replaceSaleItems (auth: AuthCtx, saleId: string, items: SaleItemInput[]) {
  const { error: delError } = await auth.supabase
    .from('pos_sale_items')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('sale_id', saleId)

  if (delError) return { ok: false as const, error: 'db_error' as const }

  if (items.length > 0) {
    const rows = items.map((item) => ({
      organization_id: auth.organizationId,
      sale_id: saleId,
      product_id: item.product_id,
      quantity: toInt(item.quantity, 1),
      unit_price_cents: toInt(item.unit_price_cents, 0),
      unit_cost_cents: 0,
      discount_cents: toInt(item.discount_cents ?? 0, 0),
      subtotal_cents: calcItemSubtotal(item),
    }))
    const { error: insError } = await auth.supabase.from('pos_sale_items').insert(rows)
    if (insError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function replaceSalePayments (auth: AuthCtx, saleId: string, payments: SalePaymentInput[]) {
  const { error: delError } = await auth.supabase
    .from('pos_sale_payments')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('sale_id', saleId)

  if (delError) return { ok: false as const, error: 'db_error' as const }

  if (payments.length > 0) {
    const rows = payments.map((payment) => ({
      organization_id: auth.organizationId,
      sale_id: saleId,
      payment_method_id: payment.payment_method_id ?? null,
      payment_method_type: payment.payment_method_type,
      amount_cents: toInt(payment.amount_cents, 1),
      status: payment.status ?? 'paid',
      metadata: payment.metadata ?? null,
    }))
    const { error: insError } = await auth.supabase.from('pos_sale_payments').insert(rows)
    if (insError) return { ok: false as const, error: 'db_error' as const }
  }

  return { ok: true as const }
}

export async function loadSale (auth: AuthCtx, saleId: string) {
  const { data: sale, error: saleError } = await auth.supabase
    .from('pos_sales')
    .select('id, sale_number, status, seller_user_id, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, cash_session_id, created_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', saleId)
    .maybeSingle()

  if (saleError) return { ok: false as const, error: 'db_error' as const }
  if (!sale) return { ok: false as const, error: 'not_found' as const }

  const [items, payments] = await Promise.all([
    auth.supabase
      .from('pos_sale_items')
      .select('id, product_id, quantity, unit_price_cents, unit_cost_cents, discount_cents, subtotal_cents, products(id, name, sku, barcode)')
      .eq('organization_id', auth.organizationId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true }),
    auth.supabase
      .from('pos_sale_payments')
      .select('id, payment_method_id, payment_method_type, amount_cents, status, metadata')
      .eq('organization_id', auth.organizationId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true }),
  ])

  if (items.error || payments.error) return { ok: false as const, error: 'db_error' as const }

  return {
    ok: true as const,
    sale,
    items: items.data ?? [],
    payments: payments.data ?? [],
  }
}

async function loadSaleItemsForFinalize (auth: AuthCtx, saleId: string) {
  const itemsRes = await listSaleItems(auth, saleId)
  if (!itemsRes.ok) return itemsRes
  if (itemsRes.items.length === 0) return { ok: false as const, error: 'empty_sale' as const }
  return { ok: true as const, items: itemsRes.items }
}

export async function finalizeSale (auth: AuthCtx, saleId: string) {
  const saleData = await loadSale(auth, saleId)
  if (!saleData.ok) return saleData
  if (saleData.sale.status === 'paid') return { ok: true as const, sale: saleData.sale }
  if (saleData.sale.status === 'canceled') return { ok: false as const, error: 'sale_canceled' as const }

  const itemsResult = await loadSaleItemsForFinalize(auth, saleId)
  if (!itemsResult.ok) return itemsResult

  const paidAmount = saleData.payments.reduce((acc, p) => acc + toInt(p.amount_cents, 0), 0)
  const total = toInt(saleData.sale.total_cents, 0)
  if (paidAmount < total) return { ok: false as const, error: 'payment_insufficient' as const }

  const hasCash = saleData.payments.some((p) => p.payment_method_type === 'dinheiro')
  const change = hasCash ? Math.max(0, paidAmount - total) : 0

  for (const item of itemsResult.items) {
    const quantity = toInt(item.quantity, 1)
    const unitCost = toInt(item.unit_cost_cents ?? 0, 0)
    const ref = `pdv_sale:${saleId}:item:${item.id}`
    const { error: movError } = await auth.supabase
      .from('product_stock_movements')
      .insert({
        organization_id: auth.organizationId,
        product_id: item.product_id,
        type: 'exit',
        quantity,
        unit_value_cents: unitCost,
        total_value_cents: unitCost * quantity,
        source: 'pdv_sale',
        external_reference: ref,
        created_by: auth.userId,
      })
    if (movError) return { ok: false as const, error: 'db_error' as const }
  }

  const { error: updError } = await auth.supabase
    .from('pos_sales')
    .update({
      status: 'paid',
      paid_amount_cents: paidAmount,
      change_cents: change,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', auth.organizationId)
    .eq('id', saleId)

  if (updError) return { ok: false as const, error: 'db_error' as const }
  try {
    await syncPdvSaleFinancialTransactions({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      saleId: saleId,
    })
  } catch {
    return { ok: false as const, error: 'db_error' as const }
  }
  return { ok: true as const, sale: { ...saleData.sale, status: 'paid', paid_amount_cents: paidAmount, change_cents: change } }
}
