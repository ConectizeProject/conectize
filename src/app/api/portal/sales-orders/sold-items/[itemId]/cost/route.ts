import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  paymentFeeCentsForSaleEntries,
  paymentFeeDetailsForSaleEntries,
} from '@/lib/resale/resale-commission'
import { computeSoldItemMargin } from '@/lib/vendas/sold-item-margin'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import {
  extractOsSoldProductLines,
  parseSoldOsItemId,
} from '@/lib/vendas/sold-os-product-lines'

type Params = Promise<{ itemId: string }>

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function paymentInstallments (metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 1
  const n = Number((metadata as { installments?: unknown }).installments)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1
}

function allocateProportion (
  totalCents: number,
  itemSubtotalCents: number,
  orderTotalCents: number,
): number {
  const total = Math.max(0, Math.trunc(totalCents) || 0)
  if (total <= 0) return 0
  const sub = Math.max(0, Math.trunc(itemSubtotalCents) || 0)
  const orderTotal = Math.max(0, Math.trunc(orderTotalCents) || 0)
  if (orderTotal <= 0) return 0
  return Math.floor((total * sub) / orderTotal)
}

function marginPayload (margin: ReturnType<typeof computeSoldItemMargin>) {
  return {
    revenueCents: margin.revenueCents,
    shippingCents: margin.shippingCents,
    feeCents: margin.feeCents,
    feeDetails: margin.feeDetails,
    effectiveUnitCostCents: margin.effectiveUnitCostCents,
    costTotalCents: margin.costTotalCents,
    grossProfitCents: margin.grossProfitCents,
    taxCents: margin.taxCents,
    contributionMarginCents: margin.contributionMarginCents,
    contributionMarginPercent: margin.contributionMarginPercent,
    canEditCost: margin.canEditCost,
  }
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
  const osRef = parseSoldOsItemId(itemId)
  if (!osRef && !UUID_RE.test(itemId)) {
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

  if (osRef) {
    const { data: orderRow, error: orderErr } = await auth.supabase
      .from('service_orders')
      .select('id, status, services, services_total_cents, payment_methods')
      .eq('organization_id', auth.organizationId)
      .eq('id', osRef.orderId)
      .maybeSingle()

    if (orderErr) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    if (!orderRow?.id || String(orderRow.status) !== 'finalizada') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const servicesRaw = orderRow.services
    const services = Array.isArray(servicesRaw)
      ? [...servicesRaw]
      : typeof servicesRaw === 'string'
        ? (() => {
          try {
            const p = JSON.parse(servicesRaw)
            return Array.isArray(p) ? [...p] : []
          } catch {
            return []
          }
        })()
        : []

    if (osRef.lineIndex >= services.length) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const line = services[osRef.lineIndex]
    if (!line || typeof line !== 'object' || String((line as { kind?: unknown }).kind) !== 'product') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }

    const productId = parseOptionalUuid((line as { sourceProductId?: unknown }).sourceProductId)
    if (!productId) {
      return NextResponse.json({ ok: false, error: 'product_required' }, { status: 400 })
    }

    const quantityRaw = Number.parseInt(String((line as { quantity?: unknown }).quantity ?? '1'), 10)
    const quantity =
      Number.isFinite(quantityRaw) && quantityRaw > 0
        ? Math.min(9999, Math.max(1, quantityRaw))
        : 1
    const nextLine = {
      ...(line as Record<string, unknown>),
      unitCostCents,
      costCents: unitCostCents * quantity,
      noCost: false,
    }
    services[osRef.lineIndex] = nextLine

    const { error: updOsErr } = await auth.supabase
      .from('service_orders')
      .update({
        services,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', auth.organizationId)
      .eq('id', osRef.orderId)

    if (updOsErr) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const { data: productRow, error: productErr } = await auth.supabase
      .from('products')
      .select('id, cost_price_cents')
      .eq('organization_id', auth.organizationId)
      .eq('id', productId)
      .maybeSingle()

    if (productErr || !productRow?.id) {
      return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
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

    const extracted = extractOsSoldProductLines(services).find(
      (l) => l.lineIndex === osRef.lineIndex,
    )
    const subtotalCents = extracted?.valueCents
      ?? Math.max(0, Number((line as { valueCents?: unknown }).valueCents) || 0)
      || Math.max(0, Number((line as { unitValueCents?: unknown }).unitValueCents) || 0) * quantity
    const orderTotalCents = Math.max(0, Number(orderRow.services_total_cents) || 0)

    let orderFeeCents = 0
    let orderFeeDetails: Array<{ label: string, amountCents: number }> = []
    const payRaw = orderRow.payment_methods
    const payArr = Array.isArray(payRaw)
      ? payRaw
      : typeof payRaw === 'string'
        ? (() => {
          try {
            const p = JSON.parse(payRaw)
            return Array.isArray(p) ? p : []
          } catch {
            return []
          }
        })()
        : []
    const entries = payArr
      .map((pay) => {
        if (!pay || typeof pay !== 'object') return null
        const pmId = parseOptionalUuid((pay as { payment_method_id?: unknown }).payment_method_id)
        if (!pmId) return null
        return {
          payment_method_id: pmId,
          value_cents: Math.max(0, Number((pay as { value_cents?: unknown }).value_cents) || 0),
          installments: Math.max(
            1,
            Math.min(24, Number((pay as { installments?: unknown }).installments) || 1),
          ),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e != null)

    if (entries.length > 0) {
      const pmIds = [...new Set(entries.map((e) => e.payment_method_id))]
      const { data: pmRows } = await auth.supabase
        .from('payment_methods')
        .select('id, description, fee_percent, type, credit_installment_fees')
        .eq('organization_id', auth.organizationId)
        .in('id', pmIds)
      const paymentMethods = (pmRows ?? []).map((row) => ({
        id: String(row.id),
        description: String(row.description || ''),
        fee_percent: Number(row.fee_percent) || 0,
        type: String(row.type || ''),
        credit_installment_fees: Array.isArray(row.credit_installment_fees)
          ? row.credit_installment_fees
          : null,
      }))
      orderFeeCents = paymentFeeCentsForSaleEntries(entries, paymentMethods)
      orderFeeDetails = paymentFeeDetailsForSaleEntries(entries, paymentMethods)
    }

    const [{ data: fiscalProfile }, { data: fiscalDocs }] = await Promise.all([
      auth.supabase
        .from('organization_fiscal_profiles')
        .select('margin_tax_percent')
        .eq('organization_id', auth.organizationId)
        .maybeSingle(),
      auth.supabase
        .from('fiscal_documents')
        .select('id')
        .eq('organization_id', auth.organizationId)
        .eq('service_order_id', osRef.orderId)
        .eq('status', 'authorized')
        .in('model', ['55', '65'])
        .limit(1),
    ])

    const marginTaxPercent = Number(
      (fiscalProfile as { margin_tax_percent?: number | null } | null)?.margin_tax_percent,
    ) || 0
    const allocatedFeeCents = allocateProportion(orderFeeCents, subtotalCents, orderTotalCents)
    const feeDetails =
      orderFeeCents > 0 && allocatedFeeCents > 0
        ? orderFeeDetails.map((d) => ({
          label: d.label,
          amountCents: allocateProportion(d.amountCents, subtotalCents, orderTotalCents),
        })).filter((d) => d.amountCents > 0)
        : []

    const margin = computeSoldItemMargin({
      quantity,
      subtotalCents,
      lineUnitCostCents: unitCostCents,
      productCostCents:
        scope === 'sale_and_product'
          ? unitCostCents
          : Math.max(0, Number(productRow.cost_price_cents) || 0),
      hasProduct: true,
      allocatedShippingCents: 0,
      allocatedFeeCents,
      feeDetails,
      marginTaxPercent,
      hasAuthorizedFiscalDoc: (fiscalDocs ?? []).length > 0,
    })

    return NextResponse.json({
      ok: true,
      itemId,
      productId,
      unitCostCents,
      scope,
      margin: marginPayload(margin),
    })
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
        total_cents,
        surcharge_cents
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
    surcharge_cents?: number
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
  let orderFeeDetails: Array<{ label: string, amountCents: number }> = []
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
      .select('id, description, fee_percent, type, credit_installment_fees')
      .eq('organization_id', auth.organizationId)
      .in('id', pmIds)
    const paymentMethods = (pmRows ?? []).map((row) => ({
      id: String(row.id),
      description: String(row.description || ''),
      fee_percent: Number(row.fee_percent) || 0,
      type: String(row.type || ''),
      credit_installment_fees: Array.isArray(row.credit_installment_fees)
        ? row.credit_installment_fees
        : null,
    }))
    orderFeeCents = paymentFeeCentsForSaleEntries(entries, paymentMethods)
    orderFeeDetails = paymentFeeDetailsForSaleEntries(entries, paymentMethods)
  }

  const [{ data: fiscalProfile }, { data: fiscalDocs }] = await Promise.all([
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('margin_tax_percent')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
    auth.supabase
      .from('fiscal_documents')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .eq('status', 'authorized')
      .in('model', ['55', '65'])
      .limit(1),
  ])

  const marginTaxPercent = Number(
    (fiscalProfile as { margin_tax_percent?: number | null } | null)?.margin_tax_percent,
  ) || 0
  const hasAuthorizedFiscalDoc = (fiscalDocs ?? []).length > 0

  const quantity = Math.max(1, Number((itemRow as { quantity?: number }).quantity) || 1)
  const subtotalCents = Math.max(
    0,
    Number((itemRow as { subtotal_cents?: number }).subtotal_cents) || 0,
  )
  const orderTotalCents = Math.max(0, Number(order.total_cents) || 0)
  const orderShippingCents = Math.max(0, Number(order.surcharge_cents) || 0)
  const allocatedFeeCents = allocateProportion(orderFeeCents, subtotalCents, orderTotalCents)
  const allocatedShippingCents = allocateProportion(
    orderShippingCents,
    subtotalCents,
    orderTotalCents,
  )
  const feeDetails =
    orderFeeCents > 0 && allocatedFeeCents > 0
      ? orderFeeDetails.map((d) => ({
        label: d.label,
        amountCents: allocateProportion(d.amountCents, subtotalCents, orderTotalCents),
      })).filter((d) => d.amountCents > 0)
      : []

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
    allocatedShippingCents,
    allocatedFeeCents,
    feeDetails,
    marginTaxPercent,
    hasAuthorizedFiscalDoc,
  })

  return NextResponse.json({
    ok: true,
    itemId,
    productId,
    unitCostCents,
    scope,
    margin: marginPayload(margin),
  })
}
