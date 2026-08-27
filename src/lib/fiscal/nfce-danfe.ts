import 'server-only'
import QRCode from 'qrcode'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import type { CompanyPrintData } from '@/lib/ordem-print'
import {
  fiscalIePrintLabel,
  formatFiscalEmitenteAddress,
} from '@/lib/fiscal/fiscal-print'
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

export async function buildNfceDanfeHtml (
  auth: PortalAuthStaffSuccess,
  fiscalDocumentId: string,
  options?: { autoPrint?: boolean },
): Promise<{ status: number, html?: string }> {
  const { data: fiscalDocument, error: docError } = await auth.supabase
    .from('fiscal_documents')
    .select('id, sales_order_id, status, access_key, protocol, qr_code_url, authorized_at, environment')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .eq('model', '65')
    .maybeSingle()

  if (docError) return { status: 500 }
  if (!fiscalDocument || !fiscalDocument.sales_order_id) return { status: 404 }
  if (fiscalDocument.status !== 'authorized') return { status: 409 }

  const orderId = String(fiscalDocument.sales_order_id)
  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, customer_name, customer_document, subtotal_cents, discount_total_cents, surcharge_cents, total_cents, paid_amount_cents, change_cents, created_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) return { status: 500 }
  if (!order) return { status: 404 }

  const [{ data: items }, { data: payments }, { data: companyRow }, { data: fiscalProfile }] = await Promise.all([
    auth.supabase
      .from('sales_order_items')
      .select('quantity, unit_price_cents, discount_cents, subtotal_cents, products(name, sku)')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    auth.supabase
      .from('sales_order_payments')
      .select('payment_method_type, amount_cents, metadata')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .order('created_at', { ascending: true }),
    auth.supabase
      .from('organizations')
      .select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
      .eq('id', auth.organizationId)
      .maybeSingle(),
    auth.supabase
      .from('organization_fiscal_profiles')
      .select('legal_name, trade_name, cnpj, state_registration, state_registration_exempt, street, number, complement, district, zip_code, city, state')
      .eq('organization_id', auth.organizationId)
      .maybeSingle(),
  ])

  const fiscalAddress = formatFiscalEmitenteAddress(fiscalProfile)
  const company: CompanyPrintData | null = (fiscalProfile || companyRow)
    ? {
      name: fiscalProfile?.legal_name || fiscalProfile?.trade_name || companyRow?.name || null,
      cnpj: fiscalProfile?.cnpj || companyRow?.cnpj || null,
      address: fiscalAddress || companyRow?.address || null,
      complement: fiscalAddress ? null : (companyRow?.complement ?? null),
      zipCode: fiscalAddress ? null : (companyRow?.zip_code ?? null),
      city: fiscalAddress ? null : (companyRow?.city ?? null),
      state: fiscalAddress ? null : (companyRow?.state ?? null),
      phone: companyRow?.phone ?? null,
      email: companyRow?.email ?? null,
      logoUrl: companyRow?.logo_url ?? null,
      ie: fiscalIePrintLabel(fiscalProfile),
    }
    : null

  const cupomPayments: SalesCupomPayment[] = (payments || []).map((p) => {
    const type = String(p.payment_method_type || '')
    return {
      methodLabel: paymentLabel(type),
      amountCents: Number(p.amount_cents) || 0,
    }
  })

  const qrCodeUrl = fiscalDocument.qr_code_url ? String(fiscalDocument.qr_code_url) : null
  const qrCodeDataUrl = qrCodeUrl
    ? await QRCode.toDataURL(qrCodeUrl, { margin: 1, width: 160 })
    : null
  const customerDocument = String(order.customer_document || '').replace(/\D/g, '')

  const cupom: SalesCupomData = {
    orderNumber: order.order_number,
    createdAt: String(order.created_at || new Date().toISOString()),
    customerName: order.customer_name,
    customerDocument: order.customer_document,
    subtotalCents: Number(order.subtotal_cents) || 0,
    discountTotalCents: Number(order.discount_total_cents) || 0,
    surchargeCents: Number(order.surcharge_cents) || 0,
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
    fiscal: {
      title: 'DANFE NFC-e - Nota Fiscal de Consumidor Eletrônica',
      accessKey: fiscalDocument.access_key ?? null,
      protocol: fiscalDocument.protocol ?? null,
      qrCodeUrl,
      qrCodeDataUrl,
      authorizationDate: fiscalDocument.authorized_at ?? null,
      environment: fiscalDocument.environment ?? null,
      consumerLabel: customerDocument
        ? `Consumidor: ${customerDocument}`
        : 'CONSUMIDOR NÃO IDENTIFICADO',
    },
  }

  return {
    status: 200,
    html: buildSalesCupomHtml(cupom, company, { autoPrint: options?.autoPrint !== false }),
  }
}
