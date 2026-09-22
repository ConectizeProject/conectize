import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { paymentFeeCentsForSaleEntries } from '@/lib/resale/resale-commission'
import { computeSoldItemMargin } from '@/lib/vendas/sold-item-margin'

type Params = Promise<{ itemId: string }>

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function paymentInstallments (metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 1
  const n = Number((metadata as { installments?: unknown }).installments)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1
}

export async function PATCH (
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { itemId } = await params
  if (!UUID_RE.test(itemId)) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const scopeRaw = String(body.scope || '').trim()
  if (scopeRaw !== 'sale' && scopeRaw !== 'sale_and_product') {
    return NextResponse.json({ ok: false, error: 'scope_invalid' }, { status: 400 })
  }
  const scope = scopeRaw as 'sale' | 'sale_and_product'

  const unitCostRaw = body.unitCostCents
  const unitCostCents = Math.round(Number(unitCostRaw))
  if (!Number.isFinite(unitCostCents) || unitCostCents < 0) {
    return NextResponse.json({ ok: false, error: 'unit_cost_invalid' }, { status: 400 })
  }

  const { data: itemRow, error: itemErr } = await auth.supabase
    .from('sales_order_items')
    .select(
      `
      id,
      product_id,
      quantity,
      unit_price_cents,
      unit_cost_cents,
      subtotal_cents,
      sales_orders!inner (
        id,
        status,
        total_cents
      )
    `,
    )
    .eq('organization_id', auth.organizationId)
    .eq('id', itemId)
    .maybeSingle()

  if (itemErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!itemRow) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const orderRaw = (itemRow as { sales_orders?: unknown }).sales_orders
  const order = (Array.isArray(orderRaw) ? orderRaw[0] : orderRaw) as {
    id?: string
    status?: string
    total_cents?: number
  } | null
  if (!order?.id || order.status !== 'paid') {
    return NextResponse.json({ ok: false, error: 'order_not_paid' }, { status: 400 })
  }

  const productId = String((itemRow as { product_id?: string }).product_id || '')
  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ ok: false, error: 'product_required' }, { status: 400 })
  }

  const { data: productRow, error: productErr } = await auth.supabase
    .from('products')
    .select('id, cost_price_cents')
    .eq('organization_id', auth.organizationId)
    .eq('id', productId)
    .maybeSingle()

  if (productErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!productRow?.id) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }

  const { error: updItemErr } = await auth.supabase
    .from('sales_order_items')
    .update({ unit_cost_cents: unitCostCents })
    .eq('organization_id', auth.organizationId)
    .eq('id', itemId)

  if (updItemErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (scope === 'sale_and_product') {
    const { error: updProductErr } = await auth.supabase
      .from('products')
      .update({
        cost_price_cents: unitCostCents,
        cost_price_manual_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', auth.organizationId)
      .eq('id', productId)

    if (updProductErr) {
      return NextResponse.json({ ok: false, error: 'product_update_failed' }, { status: 500 })
    }
  }

  const orderId = String(order.id)
  let orderFeeCents = 0
  const { data: payRows } = await auth.supabase
    .from('sales_order_payments')
    .select('payment_method_id, amount_cents, status, metadata')
    .eq('organization_id', auth.organizationId)
    .eq('sales_order_id', orderId)
    .neq('status', 'canceled')

  const entries = (payRows ?? [])
    .map((pay) => {
      const pmId = String((pay as { payment_method_id?: string | null }).payment_method_id || '')
      if (!pmId) return null
      return {
        payment_method_id: pmId,
        value_cents: Math.max(0, Number((pay as { amount_cents?: number }).amount_cents) || 0),
        installments: paymentInstallments((pay as { metadata?: unknown }).metadata),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e != null)

  if (entries.length > 0) {
    const pmIds = [...new Set(entries.map((e) => e.payment_method_id))]
    const { data: pmRows } = await auth.supabase
      .from('payment_methods')
      .select('id, fee_percent, type, credit_installment_fees')
      .eq('organization_id', auth.organizationId)
      .in('id', pmIds)
    const paymentMethods = (pmRows ?? []).map((row) => ({
      id: String(row.id),
      fee_percent: Number(row.fee_percent) || 0,
      type: String(row.type || ''),
      credit_installment_fees: Array.isArray(row.credit_installment_fees)
        ? row.credit_installment_fees
        : null,
    }))
    orderFeeCents = paymentFeeCentsForSaleEntries(entries, paymentMethods)
  }

  const quantity = Math.max(1, Number((itemRow as { quantity?: number }).quantity) || 1)
  const subtotalCents = Math.max(
    0,
    Number((itemRow as { subtotal_cents?: number }).subtotal_cents) || 0,
  )
  const orderTotalCents = Math.max(0, Number(order.total_cents) || 0)
  const allocatedFeeCents =
    orderTotalCents > 0
      ? Math.floor((orderFeeCents * subtotalCents) / orderTotalCents)
      : 0

  const productCostCents =
    scope === 'sale_and_product'
      ? unitCostCents
      : Math.max(0, Number(productRow.cost_price_cents) || 0)

  const margin = computeSoldItemMargin({
    quantity,
    subtotalCents,
    lineUnitCostCents: unitCostCents,
    productCostCents,
    hasProduct: true,
    allocatedFeeCents,
  })

  return NextResponse.json({
    ok: true,
    itemId,
    productId,
    unitCostCents,
    scope,
    margin: {
      revenueCents: margin.revenueCents,
      effectiveUnitCostCents: margin.effectiveUnitCostCents,
      costTotalCents: margin.costTotalCents,
      grossMarginCents: margin.grossMarginCents,
      feeCents: margin.feeCents,
      netMarginCents: margin.netMarginCents,
      netMarginPercent: margin.netMarginPercent,
      canEditCost: margin.canEditCost,
    },
  })
}
