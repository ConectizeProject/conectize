import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompanyPrintData } from '@/lib/ordem-print'
import {
  buildSalesCupomHtml,
  type SalesCupomData,
  type SalesCupomPayment,
} from '@/lib/sales-orders/cupom-print'

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  outro: 'Outro',
}

function paymentLabel (type: string) {
  return PAYMENT_LABELS[type] || type || 'Pagamento'
}

export async function buildSalesOrderCupomHtml (
  supabase: SupabaseClient,
  organizationId: string,
  orderId: string
): Promise<{ status: number, html?: string }> {
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .select('id, order_number, status, customer_name, customer_document, subtotal_cents, discount_total_cents, total_cents, paid_amount_cents, change_cents, created_at, organization_id')
    .eq('organization_id', organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) return { status: 500 }
  if (!order) return { status: 404 }

  const [{ data: items }, { data: payments }, { data: companyRow }] = await Promise.all([
    supabase
      .from('sales_order_items')
      .select('quantity, unit_price_cents, discount_cents, subtotal_cents, products(name, sku)')
      .eq('organization_id', organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('sales_order_payments')
      .select('payment_method_type, amount_cents, metadata')
      .eq('organization_id', organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('organizations')
      .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
      .eq('id', organizationId)
      .maybeSingle(),
  ])

  const company: CompanyPrintData | null = companyRow
    ? {
      name: companyRow.name ?? null,
      cnpj: companyRow.cnpj ?? null,
      address: companyRow.address ?? null,
      complement: companyRow.complement ?? null,
      zipCode: companyRow.zip_code ?? null,
      city: companyRow.city ?? null,
      state: companyRow.state ?? null,
      phone: companyRow.phone ?? null,
      email: companyRow.email ?? null,
      logoUrl: companyRow.logo_url ?? null,
    }
    : null

  const cupomPayments: SalesCupomPayment[] = (payments || []).map((p) => {
    const type = String(p.payment_method_type || '')
    const meta = p.metadata && typeof p.metadata === 'object'
      ? p.metadata as { installments?: number }
      : null
    const installments = Math.max(1, Number(meta?.installments) || 1)
    const baseLabel = paymentLabel(type)
    const methodLabel = type === 'credito' && installments > 1
      ? `${baseLabel} ${installments}x`
      : baseLabel
    return {
      methodLabel,
      amountCents: Number(p.amount_cents) || 0,
    }
  })

  const cupom: SalesCupomData = {
    orderNumber: order.order_number,
    createdAt: String(order.created_at || new Date().toISOString()),
    customerName: order.customer_name,
    customerDocument: order.customer_document,
    subtotalCents: Number(order.subtotal_cents) || 0,
    discountTotalCents: Number(order.discount_total_cents) || 0,
    totalCents: Number(order.total_cents) || 0,
    paidAmountCents: Number(order.paid_amount_cents) || 0,
    changeCents: Number(order.change_cents) || 0,
    items: (items || []).map((item) => {
      const productRaw = item.products
      const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as {
        name?: string | null
        sku?: string | null
      } | null
      return {
        name: product?.name || 'Produto',
        sku: product?.sku ?? null,
        quantity: Number(item.quantity) || 1,
        unitPriceCents: Number(item.unit_price_cents) || 0,
        discountCents: Number(item.discount_cents) || 0,
        subtotalCents: Number(item.subtotal_cents) || 0,
      }
    }),
    payments: cupomPayments,
  }

  return { status: 200, html: buildSalesCupomHtml(cupom, company) }
}
