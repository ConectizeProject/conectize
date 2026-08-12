import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  applyResaleDevicesListFilters,
  DEVICE_SELECT,
  parseResaleDevicesPagination,
  resaleDevicesListOrder,
  type ResaleDevicesListFilterParams,
} from '@/lib/resale/resale-devices-list-filters'

function cleanText(value: unknown): string {
  return String(value ?? '').trim()
}

function hasPurchaseValueMutation(body: Record<string, unknown>): boolean {
  return body.purchase_value_cents !== undefined || body.purchase_value !== undefined
}

function redactPurchaseValue(row: Record<string, unknown>, canView: boolean): Record<string, unknown> {
  if (canView) return row
  return { ...row, purchase_value_cents: null }
}

function toCents(value: unknown, alreadyCents = false): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return alreadyCents ? Math.round(value) : Math.round(value * 100)
  }
  const s = String(value).trim().replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(s)
  if (Number.isNaN(n)) return null
  return Math.round(n * 100)
}

function toDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  return s
}

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const soldParam = searchParams.get('sold')
  const q = String(searchParams.get('q') || '').trim()
  const condition = String(searchParams.get('condition') || '').trim()
  const storageGb = String(searchParams.get('storageGb') || '').trim()
  const color = String(searchParams.get('color') || '').trim()
  const purchaseDateFrom = String(searchParams.get('purchaseDateFrom') || '').trim()
  const purchaseDateTo = String(searchParams.get('purchaseDateTo') || '').trim()
  const stockType = String(searchParams.get('stockType') || '').trim()
  const deviceName = String(searchParams.get('deviceName') || '').trim()

  const soldFilter = soldParam === 'true'
  const listFilters: ResaleDevicesListFilterParams = {
    soldFilter,
    q,
    condition,
    storageGb,
    color,
    purchaseDateFrom,
    purchaseDateTo,
    stockType,
    deviceName,
  }
  const { limit, offset } = parseResaleDevicesPagination(
    searchParams.get('limit'),
    searchParams.get('offset'),
  )

  let countQuery = applyResaleDevicesListFilters(
    auth.supabase.from('resale_devices').select('id', { count: 'exact', head: true }),
    listFilters,
  )
  let dataQuery = applyResaleDevicesListFilters(
    auth.supabase.from('resale_devices').select(DEVICE_SELECT),
    listFilters,
  )
  dataQuery = resaleDevicesListOrder(dataQuery, soldFilter)
  if (limit != null) {
    dataQuery = dataQuery.range(offset, offset + limit - 1)
  }

  const [{ count: totalCount, error: countError }, { data: devices, error }] = await Promise.all([
    limit != null ? countQuery : Promise.resolve({ count: null, error: null }),
    dataQuery,
  ])

  if (error || countError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const ids = (devices || []).map((d: { id: string }) => d.id)
  const costsMap: Record<string, { id: string; description: string | null; value_cents: number }[]> = {}
  if (ids.length > 0) {
    const { data: costs } = await auth.supabase
      .from('resale_device_costs')
      .select('id, resale_device_id, description, value_cents')
      .in('resale_device_id', ids)
    for (const c of costs || []) {
      const rid = (c as { resale_device_id: string }).resale_device_id
      if (!costsMap[rid]) costsMap[rid] = []
      costsMap[rid].push({
        id: (c as { id: string }).id,
        description: (c as { description: string | null }).description ?? null,
        value_cents: (c as { value_cents: number }).value_cents ?? 0,
      })
    }
  }

  const list = (devices || []).map((d: Record<string, unknown>) => redactPurchaseValue({
    ...d,
    costs: costsMap[(d.id as string)] || [],
  }, auth.isAdmin))

  const total = limit != null && typeof totalCount === 'number' ? totalCount : list.length
  const hasMore = limit != null && offset + list.length < total

  return NextResponse.json({
    ok: true,
    devices: list,
    ...(limit != null ? { total, hasMore, limit, offset } : {}),
  })
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  if (!auth.isAdmin && hasPurchaseValueMutation(body as Record<string, unknown>)) {
    return NextResponse.json({ ok: false, error: 'purchase_value_forbidden' }, { status: 403 })
  }

  const device_model_id = body.device_model_id || null
  const payment_method_id = body.payment_method_id || null
  const payment_installments = body.payment_installments ?? body.installments ?? null
  const buyer_name = body.buyer_name || null
  const buyer_cpf = body.buyer_cpf || null
  const sale_details = body.sale_details || null

  const stockTypeRaw = cleanText(body.stock_type).toLowerCase()
  const stock_type = stockTypeRaw === 'lacrado' ? 'lacrado' : 'seminovo'

  const row = {
    organization_id: auth.organizationId,
    device_model_id: device_model_id || null,
    device_name: cleanText(body.device_name) || null,
    model: cleanText(body.model) || null,
    color: cleanText(body.color) || null,
    storage_gb: cleanText(body.storage_gb) || null,
    battery: cleanText(body.battery) || null,
    condition: cleanText(body.condition) || null,
    info: cleanText(body.info) || null,
    imei: cleanText(body.imei) || null,
    imei2: cleanText(body.imei2) || null,
    serial: cleanText(body.serial) || null,
    purchase_value_cents: toCents(body.purchase_value_cents ?? body.purchase_value, !!body.purchase_value_cents),
    wholesale_value_cents: toCents(body.wholesale_value_cents ?? body.wholesale_value, !!body.wholesale_value_cents),
    expected_profit_wholesale_cents: toCents(body.expected_profit_wholesale_cents ?? body.expected_profit_wholesale, !!body.expected_profit_wholesale_cents),
    sale_value_cents: toCents(body.sale_value_cents ?? body.sale_value, !!body.sale_value_cents),
    expected_profit_sale_cents: toCents(body.expected_profit_sale_cents ?? body.expected_profit_sale, !!body.expected_profit_sale_cents),
    sold_for_cents: toCents(body.sold_for_cents ?? body.sold_for, !!body.sold_for_cents),
    advertised: Boolean(body.advertised),
    tested: Boolean(body.tested),
    label: cleanText(body.label) || null,
    sold: Boolean(body.sold),
    actual_profit_cents: (() => {
      const val = body.actual_profit_cents ?? body.actual_profit
      return typeof val === 'number' ? Math.round(val) : toCents(val, false)
    })(),
    purchase_date: toDate(body.purchase_date),
    sale_date: toDate(body.sale_date),
    payment_method_id: payment_method_id || null,
    payment_installments: payment_installments === null || payment_installments === undefined ? null : Number(payment_installments) || null,
    buyer_name: buyer_name ? cleanText(buyer_name) : null,
    buyer_cpf: buyer_cpf ? cleanText(buyer_cpf) : null,
    sale_details: sale_details ? cleanText(sale_details) : null,
    stock_type,
    image_url: (() => {
      const u = cleanText(body.image_url)
      return u ? u.slice(0, 2048) : null
    })(),
    image_gallery_paths: Array.isArray(body.image_gallery_paths)
      ? (body.image_gallery_paths as unknown[])
          .map((x) => cleanText(x))
          .filter(Boolean)
          .slice(0, 9)
      : [],
  }

  const { data: inserted, error } = await auth.supabase
    .from('resale_devices')
    .insert(row)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const costs = Array.isArray(body.costs) ? body.costs : []
  for (const c of costs) {
    const value_cents = typeof c.value_cents === 'number' ? c.value_cents : toCents(c.value ?? c.value_cents) ?? 0
    await auth.supabase.from('resale_device_costs').insert({
      organization_id: auth.organizationId,
      resale_device_id: inserted.id,
      description: cleanText(c.description) || null,
      value_cents,
    })
  }

  const { data: costsData } = await auth.supabase
    .from('resale_device_costs')
    .select('id, description, value_cents')
    .eq('resale_device_id', inserted.id)

  return NextResponse.json({
    ok: true,
    device: { ...inserted, costs: costsData || [] },
  })
}
