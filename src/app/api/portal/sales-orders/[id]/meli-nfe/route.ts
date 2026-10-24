import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  getMeliConnectionByOrganizationId,
  getMeliInvoiceDocumentBinary,
  resolveMeliSaleInvoice,
} from '@/lib/integrations/mercado-livre/api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type Params = Promise<{ id: string }>

function parseFormat (value: string | null): 'meta' | 'danfe' | 'xml' {
  if (value === 'danfe' || value === 'xml' || value === 'meta') return value
  return 'meta'
}

export async function GET (
  request: Request,
  { params }: { params: Params },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const format = parseFormat(url.searchParams.get('format'))
  const download = url.searchParams.get('download') === '1'

  let orderRes = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, ml_order_id, ml_shipment_id, ml_logistic_type')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderRes.error && /ml_shipment_id|ml_logistic_type|does not exist|schema cache/i.test(orderRes.error.message)) {
    orderRes = await auth.supabase
      .from('sales_orders')
      .select('id, order_number, ml_order_id')
      .eq('organization_id', auth.organizationId)
      .eq('id', orderId)
      .maybeSingle()
  }

  if (orderRes.error) {
    console.error('[meli-nfe]', orderRes.error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!orderRes.data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const order = orderRes.data as {
    id: string
    order_number: number
    ml_order_id: string | null
    ml_shipment_id?: string | null
    ml_logistic_type?: string | null
  }

  const connection = await getMeliConnectionByOrganizationId(
    auth.supabase,
    auth.organizationId,
  )
  if (!connection) {
    return NextResponse.json({ ok: false, error: 'meli_not_connected' }, { status: 400 })
  }

  const invoice = await resolveMeliSaleInvoice({
    connection,
    mlOrderId: order.ml_order_id,
    mlShipmentId: order.ml_shipment_id,
    supabase: auth.supabase,
  })

  if (!invoice) {
    return NextResponse.json({
      ok: false,
      error: 'nfe_not_found',
      message: 'NF-e ainda não disponível no Mercado Livre.',
    }, { status: 404 })
  }

  if (format === 'meta') {
    return NextResponse.json({
      ok: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        authorized: invoice.authorized,
        hasDanfe: Boolean(invoice.danfeLocation),
        hasXml: Boolean(invoice.xmlLocation),
      },
    })
  }

  if (!invoice.authorized) {
    return NextResponse.json({
      ok: false,
      error: 'nfe_not_authorized',
      message: 'NF-e ainda não autorizada no Mercado Livre.',
      status: invoice.status,
    }, { status: 409 })
  }

  const documentPath = format === 'xml' ? invoice.xmlLocation : invoice.danfeLocation
  if (!documentPath) {
    return NextResponse.json({
      ok: false,
      error: 'nfe_document_missing',
      message: format === 'xml'
        ? 'XML da NF-e não disponível no Mercado Livre.'
        : 'DANFE da NF-e não disponível no Mercado Livre.',
    }, { status: 404 })
  }

  try {
    const file = await getMeliInvoiceDocumentBinary(
      connection,
      documentPath,
      auth.supabase,
    )
    const contentType = format === 'xml'
      ? (file.contentType || 'application/xml')
      : (file.contentType || 'application/pdf')
    const extension = format === 'xml' ? 'xml' : 'pdf'
    const filename = `nfe-meli-${order.order_number || order.id}.${extension}`
    const disposition = download
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`

    return new NextResponse(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'meli_invoice_download_failed'
    console.error('[meli-nfe download]', message)
    return NextResponse.json({
      ok: false,
      error: 'download_failed',
      message: 'Não foi possível baixar a NF-e do Mercado Livre.',
    }, { status: 502 })
  }
}
