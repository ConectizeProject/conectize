import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { paymentFeeCentsForSaleEntries } from '@/lib/resale/resale-commission'
import { computeSoldItemMargin } from '@/lib/vendas/sold-item-margin'
import { vendasListPage, vendasListRange } from '@/lib/vendas/list-pagination'

type ProductJoin = {
  id?: string
  name?: string | null
  sku?: string | null
  image_url?: string | null
  cost_price_cents?: number | null
} | null

function unwrapProduct (raw: unknown): ProductJoin {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? (first as ProductJoin) : null
  }
  if (typeof raw === 'object') return raw as ProductJoin
  return null
}

function paymentInstallments (metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 1
  const n = Number((metadata as { installments?: unknown }).installments)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1
}

function allocateFeeForItem (
  orderFeeCents: number,
  itemSubtotalCents: number,
  orderTotalCents: number,
): number {
  const fee = Math.max(0, Math.trunc(orderFeeCents) || 0)
  if (fee <= 0) return 0
  const sub = Math.max(0, Math.trunc(itemSubtotalCents) || 0)
  const total = Math.max(0, Math.trunc(orderTotalCents) || 0)
  if (total <= 0) return 0
  return Math.floor((fee * sub) / total)
}

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const page = vendasListPage(searchParams.get('page'))
  const { from, to, pageSize } = vendasListRange(page)

  const { data: rows, error, count } = await auth.supabase
    .from('sales_order_items')
    .select(
      `
      id,
      product_id,
      quantity,
      unit_price_cents,
      unit_cost_cents,
      discount_cents,
      subtotal_cents,
      created_at,
      sales_orders!inner (
        id,
        order_number,
        status,
        created_at,
        total_cents,
        ml_order_id,
        ml_pack_id,
        customer_name
      ),
      products (
        id,
        name,
        sku,
        image_url,
        cost_price_cents
      )
    `,
      { count: 'exact' },
    )
    .eq('organization_id', auth.organizationId)
    .eq('sales_orders.status', 'paid')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const items = rows ?? []
  const orderIds = [
    ...new Set(
      items.map((row) => {
        const orderRaw = (row as { sales_orders?: unknown }).sales_orders
        const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
        return order && typeof order === 'object'
          ? String((order as { id?: unknown }).id || '')
          : ''
      }).filter(Boolean),
    ),
  ]

  const feeByOrderId = new Map<string, number>()

  if (orderIds.length > 0) {
    const { data: payRows } = await auth.supabase
      .from('sales_order_payments')
      .select('sales_order_id, payment_method_id, amount_cents, status, metadata')
      .eq('organization_id', auth.organizationId)
      .in('sales_order_id', orderIds)
      .neq('status', 'canceled')

    const paymentsByOrderId = new Map<
      string,
      Array<{ payment_method_id: string, value_cents: number | null, installments: number }>
    >()

    for (const pay of payRows ?? []) {
      const oid = String((pay as { sales_order_id?: string }).sales_order_id || '')
      const pmId = String((pay as { payment_method_id?: string | null }).payment_method_id || '')
      if (!oid || !pmId) continue
      const list = paymentsByOrderId.get(oid) ?? []
      list.push({
        payment_method_id: pmId,
        value_cents: Math.max(0, Number((pay as { amount_cents?: number }).amount_cents) || 0),
        installments: paymentInstallments((pay as { metadata?: unknown }).metadata),
      })
      paymentsByOrderId.set(oid, list)
    }

    const pmIds = [
      ...new Set(
        [...paymentsByOrderId.values()].flatMap((list) =>
          list.map((e) => e.payment_method_id),
        ),
      ),
    ]
    let paymentMethods: Array<{
      id: string
      fee_percent: number
      type: string
      credit_installment_fees?: Array<{ installments: number, fee_percent: number }> | null
    }> = []
    if (pmIds.length > 0) {
      const { data: pmRows } = await auth.supabase
        .from('payment_methods')
        .select('id, fee_percent, type, credit_installment_fees')
        .eq('organization_id', auth.organizationId)
        .in('id', pmIds)
      paymentMethods = (pmRows ?? []).map((row) => ({
        id: String(row.id),
        fee_percent: Number(row.fee_percent) || 0,
        type: String(row.type || ''),
        credit_installment_fees: Array.isArray(row.credit_installment_fees)
          ? row.credit_installment_fees
          : null,
      }))
    }

    for (const oid of orderIds) {
      const entries = paymentsByOrderId.get(oid) ?? []
      feeByOrderId.set(
        oid,
        paymentFeeCentsForSaleEntries(entries, paymentMethods),
      )
    }
  }

  const mapped = items.map((row) => {
    const orderRaw = (row as { sales_orders?: unknown }).sales_orders
    const order = (Array.isArray(orderRaw) ? orderRaw[0] : orderRaw) as Record<
      string,
      unknown
    > | null
    const product = unwrapProduct((row as { products?: unknown }).products)
    const hasProduct = Boolean(product?.id)
    const orderId = order ? String(order.id || '') : ''
    const quantity = Math.max(1, Number((row as { quantity?: number }).quantity) || 1)
    const subtotalCents = Math.max(
      0,
      Number((row as { subtotal_cents?: number }).subtotal_cents) || 0,
    )
    const orderTotalCents = order
      ? Math.max(0, Number(order.total_cents) || 0)
      : 0
    const lineUnitCostCents = Math.max(
      0,
      Number((row as { unit_cost_cents?: number }).unit_cost_cents) || 0,
    )
    const productCostCents =
      product?.cost_price_cents != null
        ? Math.max(0, Number(product.cost_price_cents) || 0)
        : null

    const margin = computeSoldItemMargin({
      quantity,
      subtotalCents,
      lineUnitCostCents,
      productCostCents,
      hasProduct,
      allocatedFeeCents: allocateFeeForItem(
        feeByOrderId.get(orderId) ?? 0,
        subtotalCents,
        orderTotalCents,
      ),
    })

    return {
      id: String((row as { id?: string }).id || ''),
      productId: hasProduct ? String(product!.id) : null,
      productName: hasProduct
        ? String(product?.name || '').trim() || 'Produto'
        : 'Produto não vinculado',
      productSku: hasProduct && product?.sku ? String(product.sku) : null,
      productImageUrl:
        hasProduct && product?.image_url && String(product.image_url).trim()
          ? String(product.image_url).trim()
          : null,
      quantity,
      unitPriceCents: Math.max(
        0,
        Number((row as { unit_price_cents?: number }).unit_price_cents) || 0,
      ),
      lineUnitCostCents,
      productCostCents,
      subtotalCents,
      createdAt: String((row as { created_at?: string }).created_at || ''),
      order: {
        id: orderId,
        orderNumber: order ? Number(order.order_number) || 0 : 0,
        createdAt: order ? String(order.created_at || '') : '',
        totalCents: orderTotalCents,
        mlOrderId: order?.ml_order_id != null ? String(order.ml_order_id) : null,
        mlPackId: order?.ml_pack_id != null ? String(order.ml_pack_id) : null,
        customerName:
          order?.customer_name != null && String(order.customer_name).trim()
            ? String(order.customer_name).trim()
            : null,
      },
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
    }
  })

  return NextResponse.json({
    ok: true,
    items: mapped,
    total: count ?? mapped.length,
    page,
    pageSize,
  })
}
