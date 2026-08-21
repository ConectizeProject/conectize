import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { syncResaleDevicePurchaseFinancialTransactions } from '@/lib/finance/service-order-financial-sync'
import { onlyDigits } from '@/lib/utils/strings'
import {
  coerceRawSalePaymentsToArray,
  mapLooseEntryToSalePaymentRow,
} from '@/lib/resale/sale-payment-methods'

function cleanText (value: unknown): string {
  return String(value ?? '').trim()
}

function toCents (value: unknown, alreadyCents = false): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return alreadyCents ? Math.round(value) : Math.round(value * 100)
  }
  const s = String(value).trim().replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(s)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

function toDate (value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  return s || null
}

function parsePurchasePayments (raw: unknown, purchaseValueCents: number) {
  const fromJson = coerceRawSalePaymentsToArray(raw)
    .map(mapLooseEntryToSalePaymentRow)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      payment_method_id: String(item.payment_method_id || '').trim(),
      value_cents: item.value_cents != null ? Math.max(0, Number(item.value_cents) || 0) : null,
      installments: item.installments ?? null,
    }))
    .filter((item) => item.payment_method_id)

  if (fromJson.length === 0) return [] as Array<{
    payment_method_id: string
    value_cents: number
    installments: number | null
  }>

  const withValues = fromJson
    .map((item) => ({
      payment_method_id: item.payment_method_id,
      value_cents: item.value_cents && item.value_cents > 0
        ? item.value_cents
        : (fromJson.length === 1 ? purchaseValueCents : 0),
      installments: item.installments,
    }))
    .filter((item) => item.value_cents > 0)

  return withValues
}

export async function POST (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const deviceName = cleanText((body as Record<string, unknown>).device_name)
  if (!deviceName) {
    return NextResponse.json({
      ok: false,
      error: 'device_name_required',
      message: 'Informe o nome do aparelho.',
    }, { status: 400 })
  }

  const purchaseValueCents = toCents(
    (body as Record<string, unknown>).purchase_value_cents
      ?? (body as Record<string, unknown>).purchase_value,
    !!(body as Record<string, unknown>).purchase_value_cents,
  )
  if (purchaseValueCents === null || purchaseValueCents <= 0) {
    return NextResponse.json({
      ok: false,
      error: 'purchase_value_required',
      message: 'Informe o valor pago na compra do usado.',
    }, { status: 400 })
  }

  if (!auth.isAdmin) {
    return NextResponse.json({
      ok: false,
      error: 'purchase_value_forbidden',
      message: 'Apenas administradores podem registrar compra de usados com valor.',
    }, { status: 403 })
  }

  const sellerCustomerId = cleanText((body as Record<string, unknown>).seller_customer_id) || null
  const sellerName = cleanText((body as Record<string, unknown>).seller_name) || null
  const sellerDocument = onlyDigits(
    cleanText((body as Record<string, unknown>).seller_document)
      || cleanText((body as Record<string, unknown>).seller_cpf)
      || '',
  ) || null

  if (sellerCustomerId) {
    const { data: customer } = await auth.supabase
      .from('customers')
      .select('id, name, cpf, cnpj')
      .eq('organization_id', auth.organizationId)
      .eq('id', sellerCustomerId)
      .maybeSingle()
    if (!customer) {
      return NextResponse.json({
        ok: false,
        error: 'invalid_customer',
        message: 'Cliente vendedor não encontrado.',
      }, { status: 400 })
    }
  }

  const purchasePayments = parsePurchasePayments(
    (body as Record<string, unknown>).purchase_payment_methods,
    purchaseValueCents,
  )

  const purchaseDate = toDate((body as Record<string, unknown>).purchase_date)
    || new Date().toISOString().slice(0, 10)

  const row = {
    organization_id: auth.organizationId,
    device_name: deviceName,
    model: cleanText((body as Record<string, unknown>).model) || null,
    color: cleanText((body as Record<string, unknown>).color) || null,
    storage_gb: cleanText((body as Record<string, unknown>).storage_gb) || null,
    battery: cleanText((body as Record<string, unknown>).battery) || null,
    condition: cleanText((body as Record<string, unknown>).condition) || null,
    info: cleanText((body as Record<string, unknown>).info) || null,
    imei: cleanText((body as Record<string, unknown>).imei) || null,
    imei2: cleanText((body as Record<string, unknown>).imei2) || null,
    serial: cleanText((body as Record<string, unknown>).serial) || null,
    purchase_value_cents: purchaseValueCents,
    purchase_date: purchaseDate,
    sale_value_cents: toCents(
      (body as Record<string, unknown>).sale_value_cents
        ?? (body as Record<string, unknown>).sale_value,
      !!(body as Record<string, unknown>).sale_value_cents,
    ),
    wholesale_value_cents: toCents(
      (body as Record<string, unknown>).wholesale_value_cents
        ?? (body as Record<string, unknown>).wholesale_value,
      !!(body as Record<string, unknown>).wholesale_value_cents,
    ),
    sold: false,
    stock_type: 'seminovo' as const,
    acquisition_source: 'customer_purchase' as const,
    seller_customer_id: sellerCustomerId,
    seller_name: sellerName,
    seller_document: sellerDocument,
    purchase_payment_methods: purchasePayments.length > 0 ? purchasePayments : null,
    advertised: false,
    tested: Boolean((body as Record<string, unknown>).tested),
    image_gallery_paths: [],
  }

  const { data: inserted, error } = await auth.supabase
    .from('resale_devices')
    .insert(row)
    .select()
    .single()

  if (error || !inserted) {
    console.error('[entrada-usado] insert', error)
    return NextResponse.json({
      ok: false,
      error: 'db_error',
      message: 'Não foi possível salvar a entrada do usado.',
    }, { status: 500 })
  }

  try {
    await syncResaleDevicePurchaseFinancialTransactions({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      resaleDeviceId: String(inserted.id),
      deviceRow: {
        id: String(inserted.id),
        organization_id: auth.organizationId,
        device_name: inserted.device_name ?? null,
        model: inserted.model ?? null,
        acquisition_source: 'customer_purchase',
        purchase_value_cents: purchaseValueCents,
        purchase_payment_methods: purchasePayments,
        purchase_date: purchaseDate,
        updated_at: inserted.updated_at ?? null,
      },
    })
  } catch (err) {
    console.error('[entrada-usado] finance sync', err)
    return NextResponse.json({
      ok: true,
      device: inserted,
      warning: 'device_created_finance_failed',
      message: 'Aparelho cadastrado, mas a saída financeira não foi gerada. Verifique as formas de pagamento e contas.',
    })
  }

  return NextResponse.json({ ok: true, device: inserted })
}
