import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  createManualProductsInbound,
  createUsedDevicesInbound,
  importInboundNfeXml,
  listInboundNfeDocuments,
} from '@/lib/fiscal/inbound-nfe'

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await listInboundNfeDocuments(auth)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, documents: result.documents })
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file')
    let xmlContent = ''
    if (file instanceof File) {
      xmlContent = await file.text()
    } else if (typeof form.get('xml') === 'string') {
      xmlContent = String(form.get('xml') || '')
    }
    if (!xmlContent.trim()) {
      return NextResponse.json({
        ok: false,
        error: 'empty_xml',
        message: 'Envie o arquivo XML da NF-e.',
      }, { status: 400 })
    }
    const result = await importInboundNfeXml(auth, xmlContent)
    if (!result.ok) {
      const status = result.error === 'duplicate_access_key' ? 409 : 400
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: 'message' in result ? result.message : 'Falha ao importar XML.',
      }, { status })
    }
    return NextResponse.json({ ok: true, document: result.document })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const mode = String(body.mode || body.source_mode || '').trim()

  if (mode === 'xml' || body.xml) {
    const xmlContent = String(body.xml || '')
    if (!xmlContent.trim()) {
      return NextResponse.json({
        ok: false,
        error: 'empty_xml',
        message: 'Envie o XML da NF-e.',
      }, { status: 400 })
    }
    const result = await importInboundNfeXml(auth, xmlContent)
    if (!result.ok) {
      const status = result.error === 'duplicate_access_key' ? 409 : 400
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: 'message' in result ? result.message : 'Falha ao importar XML.',
      }, { status })
    }
    return NextResponse.json({ ok: true, document: result.document })
  }

  if (mode === 'used_devices' || mode === 'usados') {
    const result = await createUsedDevicesInbound(auth, {
      sellerCustomerId: body.seller_customer_id ? String(body.seller_customer_id) : null,
      sellerName: body.seller_name ? String(body.seller_name) : null,
      sellerDocument: body.seller_document ? String(body.seller_document) : null,
      purchaseDate: body.purchase_date ? String(body.purchase_date) : null,
      purchasePaymentMethods: body.purchase_payment_methods,
      notes: body.notes ? String(body.notes) : null,
      devices: Array.isArray(body.devices)
        ? body.devices.map((raw) => {
          const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
          const device = (row.device && typeof row.device === 'object'
            ? row.device
            : row) as Record<string, unknown>
          return {
            purchaseValueCents: Number(row.purchase_value_cents ?? row.purchaseValueCents ?? 0),
            device: {
              device_name: String(device.device_name || ''),
              color: device.color ? String(device.color) : null,
              storage_gb: device.storage_gb ? String(device.storage_gb) : null,
              battery: device.battery ? String(device.battery) : null,
              condition: device.condition ? String(device.condition) : null,
              info: device.info ? String(device.info) : null,
              imei: device.imei ? String(device.imei) : null,
              imei2: device.imei2 ? String(device.imei2) : null,
              serial: device.serial ? String(device.serial) : null,
              sale_value_cents: device.sale_value_cents != null
                ? Number(device.sale_value_cents)
                : null,
            },
          }
        })
        : [],
    })
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: 'message' in result ? result.message : 'Falha ao criar entrada de usados.',
      }, { status: 400 })
    }
    return NextResponse.json({ ok: true, document: result.document })
  }

  // manual products (default)
  const result = await createManualProductsInbound(auth, {
    issuerName: body.issuer_name ? String(body.issuer_name) : null,
    issuedAt: body.issued_at ? String(body.issued_at) : null,
    notes: body.notes ? String(body.notes) : null,
    items: Array.isArray(body.items)
      ? body.items.map((raw) => {
        const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
        return {
          description: String(row.description || ''),
          quantity: Number(row.quantity || 0),
          unitValueCents: Number(row.unit_value_cents ?? row.unitValueCents ?? 0),
          productId: row.product_id ? String(row.product_id) : null,
          productCode: row.product_code ? String(row.product_code) : null,
          barcode: row.barcode ? String(row.barcode) : null,
          ncm: row.ncm ? String(row.ncm) : null,
          unit: row.unit ? String(row.unit) : 'UN',
        }
      })
      : [],
  })
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Falha ao criar NF-e de entrada.',
    }, { status: 400 })
  }
  return NextResponse.json({ ok: true, document: result.document })
}
