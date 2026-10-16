import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  getMeliConnectionByOrganizationId,
  getMeliOrder,
  getMeliShipment,
  getMeliShipmentLabelsZpl,
} from '@/lib/integrations/mercado-livre/api'
import {
  buildCustomizedShipmentLabelZpl,
  convertZplToPdfBytes,
  convertZplToPngBytes,
  extractZplFromShipmentLabelsZip,
  uint8ToBase64,
} from '@/lib/integrations/mercado-livre/shipment-label-zpl'
import { meliLogisticTypeFromShipment } from '@/lib/vendas/sales-lane'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type Params = Promise<{ id: string }>
type LabelMode = 'preview' | 'pdf' | 'zpl_custom' | 'zpl_original'

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function unwrapProduct (value: unknown): { sku?: string | null } | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return row as { sku?: string | null }
}

function trimSku (value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

type MeliSkuLine = { sku: string | null, quantity: number }

/** seller_sku / seller_custom_field dos itens do pedido MELI (fallback quando products.sku falta). */
function skuLinesFromMeliOrder (order: Record<string, unknown> | null): MeliSkuLine[] {
  const entries = Array.isArray(order?.order_items) ? order.order_items : []
  const lines: MeliSkuLine[] = []
  for (const entry of entries) {
    const row = asRecord(entry)
    const item = asRecord(row?.item)
    lines.push({
      sku:
        trimSku(item?.seller_sku)
        || trimSku(item?.seller_custom_field)
        || null,
      quantity: Math.max(1, Math.trunc(Number(row?.quantity) || 1)),
    })
  }
  return lines
}

function parseLabelMode (value: unknown): LabelMode {
  if (value === 'zpl_custom' || value === 'zpl_original' || value === 'pdf' || value === 'preview') {
    return value
  }
  if (value === 'print') return 'preview'
  return 'preview'
}

export async function POST (
  request: Request,
  { params }: { params: Params },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const mode = parseLabelMode(body?.mode)

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id', message: 'ID inválido' }, { status: 400 })
  }

  let orderRes = await auth.supabase
    .from('sales_orders')
    .select('id, order_number, status, ml_order_id, ml_pack_id, ml_shipment_id, ml_logistic_type')
    .eq('organization_id', auth.organizationId)
    .eq('id', orderId)
    .maybeSingle()

  if (orderRes.error && /ml_shipment_id|ml_logistic_type|does not exist|schema cache/i.test(orderRes.error.message)) {
    orderRes = await auth.supabase
      .from('sales_orders')
      .select('id, order_number, status, ml_order_id, ml_pack_id')
      .eq('organization_id', auth.organizationId)
      .eq('id', orderId)
      .maybeSingle()
  }

  if (orderRes.error) {
    console.error('[meli-label]', orderRes.error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!orderRes.data) {
    return NextResponse.json({ ok: false, error: 'not_found', message: 'Pedido não encontrado' }, { status: 404 })
  }

  const order = orderRes.data as {
    id: string
    order_number: number
    status: string
    ml_order_id: string | null
    ml_pack_id: string | null
    ml_shipment_id?: string | null
    ml_logistic_type?: string | null
  }

  const mlOrderId = String(order.ml_order_id || '').trim()
  if (!mlOrderId) {
    return NextResponse.json({
      ok: false,
      error: 'not_meli_order',
      message: 'Este pedido não é do Mercado Livre.',
    }, { status: 400 })
  }

  const connection = await getMeliConnectionByOrganizationId(
    auth.supabase,
    auth.organizationId,
  )
  if (!connection) {
    return NextResponse.json({
      ok: false,
      error: 'meli_not_connected',
      message: 'Conta do Mercado Livre não conectada.',
    }, { status: 400 })
  }

  const [itemsRes, nfeRes] = await Promise.all([
    auth.supabase
      .from('sales_order_items')
      .select(`
        quantity,
        products (
          sku
        )
      `)
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId),
    auth.supabase
      .from('fiscal_documents')
      .select('id, series, number, access_key, status, model')
      .eq('organization_id', auth.organizationId)
      .eq('sales_order_id', orderId)
      .eq('model', '55')
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (itemsRes.error) {
    console.error('[meli-label items]', itemsRes.error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  let shipmentId = String(order.ml_shipment_id || '').trim()
  let logisticType = String(order.ml_logistic_type || '').trim() || null
  let meliOrder: Record<string, unknown> | null = null

  try {
    meliOrder = await getMeliOrder(connection, mlOrderId, auth.supabase) as Record<string, unknown>
    const shipping = asRecord(meliOrder.shipping)
    if (!shipmentId) shipmentId = String(shipping?.id || '').trim()
    if (shipmentId) {
      const shipment = await getMeliShipment(connection, shipmentId, auth.supabase).catch(() => null)
      logisticType = meliLogisticTypeFromShipment({
        shipment,
        shipping,
        tags: [meliOrder.tags, shipment?.tags],
      }) || logisticType
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'meli_order_failed'
    console.error('[meli-label order]', message)
    return NextResponse.json({
      ok: false,
      error: 'meli_order_failed',
      message: 'Não foi possível carregar o pedido no Mercado Livre.',
    }, { status: 502 })
  }

  if (!shipmentId) {
    return NextResponse.json({
      ok: false,
      error: 'shipment_missing',
      message: 'Envio ainda não disponível no Mercado Livre.',
    }, { status: 400 })
  }

  let zipBytes: Uint8Array
  try {
    zipBytes = await getMeliShipmentLabelsZpl(connection, shipmentId, auth.supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'meli_label_failed'
    console.error('[meli-label zip]', message)
    return NextResponse.json({
      ok: false,
      error: 'meli_label_failed',
      message: 'Etiqueta ainda não disponível no Mercado Livre. Tente novamente em instantes.',
    }, { status: 502 })
  }

  const meliSkuLines = skuLinesFromMeliOrder(meliOrder)
  const items = (itemsRes.data ?? []).map((row, index) => {
    const product = unwrapProduct((row as { products?: unknown }).products)
    const localSku = product?.sku ? String(product.sku).trim() : ''
    const meliLine = meliSkuLines[index]
      || (meliSkuLines.length === 1 ? meliSkuLines[0] : null)
    return {
      sku: localSku || meliLine?.sku || null,
      quantity: Math.max(1, Number((row as { quantity?: number }).quantity) || 1),
    }
  })

  // Pedido MELI sem itens locais vinculados: ainda injeta seller_sku do anúncio.
  if (items.length === 0) {
    for (const line of meliSkuLines) {
      if (!line.sku) continue
      items.push({ sku: line.sku, quantity: line.quantity })
    }
  }

  const nfe = nfeRes.data && !nfeRes.error
    ? {
      series: (nfeRes.data as { series?: string | number | null }).series ?? null,
      number: (nfeRes.data as { number?: string | number | null }).number ?? null,
      accessKey: (nfeRes.data as { access_key?: string | null }).access_key ?? null,
    }
    : null

  const isFlex = logisticType === 'self_service'
  const baseName = `etiqueta-meli-${order.order_number || mlOrderId}`

  if (mode === 'zpl_original') {
    let originalZpl: string
    try {
      originalZpl = extractZplFromShipmentLabelsZip(zipBytes)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'zpl_build_failed'
      console.error('[meli-label zpl original]', message)
      return NextResponse.json({
        ok: false,
        error: 'zpl_build_failed',
        message: 'Não foi possível ler o ZPL original do Mercado Livre.',
      }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      mode,
      zpl: originalZpl,
      filename: `${baseName}-meli.zpl`,
      shipmentId,
      isFlex,
    })
  }

  let zpl: string
  try {
    zpl = buildCustomizedShipmentLabelZpl({
      zipBytes,
      items,
      isFlex,
      nf: nfe,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'zpl_build_failed'
    console.error('[meli-label zpl]', message)
    return NextResponse.json({
      ok: false,
      error: 'zpl_build_failed',
      message: 'Não foi possível processar o ZPL da etiqueta.',
    }, { status: 502 })
  }

  if (mode === 'zpl_custom') {
    return NextResponse.json({
      ok: true,
      mode,
      zpl,
      filename: `${baseName}-custom.zpl`,
      shipmentId,
      isFlex,
    })
  }

  if (mode === 'pdf') {
    let pdfBytes: Uint8Array
    try {
      pdfBytes = await convertZplToPdfBytes(zpl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'zpl_pdf_failed'
      console.error('[meli-label pdf]', message)
      return NextResponse.json({
        ok: false,
        error: 'zpl_pdf_failed',
        message: 'Não foi possível converter a etiqueta para PDF.',
      }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      mode,
      pdfBase64: uint8ToBase64(pdfBytes),
      filename: `${baseName}.pdf`,
      shipmentId,
      isFlex,
    })
  }

  let pngBytes: Uint8Array
  try {
    pngBytes = await convertZplToPngBytes(zpl)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'zpl_png_failed'
    console.error('[meli-label png]', message)
    return NextResponse.json({
      ok: false,
      error: 'zpl_png_failed',
      message: 'Não foi possível processar a prévia da etiqueta.',
    }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    mode: 'preview',
    zpl,
    pngBase64: uint8ToBase64(pngBytes),
    filename: `${baseName}.png`,
    shipmentId,
    isFlex,
  })
}
