import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { attachResaleDeviceDisplayImage } from '@/lib/seminovos/resale-device-display-image'
import { normalizeSalePaymentMethodsForPersistence } from '@/lib/resale/sale-payment-methods'
import { stripSaleDerivedCosts } from '@/lib/resale/resale-sale-costs'
import {
  insertStockExitsForResaleAddons,
  parseAddonInventoryLines,
  validateAddonStockAvailable,
} from '@/lib/resale/resale-addon-stock'

type PortalSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

const DEVICE_SELECT = `
  id,
  device_model_id,
  device_name,
  model,
  color,
  storage_gb,
  battery,
  condition,
  info,
  imei,
  imei2,
  serial,
  purchase_value_cents,
  wholesale_value_cents,
  expected_profit_wholesale_cents,
  sale_value_cents,
  expected_profit_sale_cents,
  sold_for_cents,
  advertised,
  tested,
  label,
  sold,
  actual_profit_cents,
  purchase_date,
  sale_date,
  payment_method_id,
  payment_installments,
  sale_payment_methods,
  buyer_name,
  buyer_cpf,
  sale_details,
  stock_type,
  sale_commission_user_id,
  image_url,
  image_storage_path,
  image_gallery_paths,
  created_at,
  updated_at
`

function cleanText (value: unknown): string {
  return String(value ?? '').trim()
}

function hasPurchaseValueMutation (body: Record<string, unknown>): boolean {
  return body.purchase_value_cents !== undefined || body.purchase_value !== undefined
}

function redactPurchaseValue (row: Record<string, unknown>, canView: boolean): Record<string, unknown> {
  if (canView) return row
  return { ...row, purchase_value_cents: null }
}

function toCents (value: unknown, alreadyCents = false): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
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
  if (!s) return null
  return s
}

function buildPatchRow (
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  if (body.device_model_id !== undefined) {
    row.device_model_id = body.device_model_id ? parseOptionalUuid(body.device_model_id) : null
  }
  if (body.device_name !== undefined) row.device_name = cleanText(body.device_name) || null
  if (body.model !== undefined) row.model = cleanText(body.model) || null
  if (body.color !== undefined) row.color = cleanText(body.color) || null
  if (body.storage_gb !== undefined) row.storage_gb = cleanText(body.storage_gb) || null
  if (body.battery !== undefined) row.battery = cleanText(body.battery) || null
  if (body.condition !== undefined) row.condition = cleanText(body.condition) || null
  if (body.info !== undefined) row.info = cleanText(body.info) || null
  if (body.imei !== undefined) row.imei = cleanText(body.imei) || null
  if (body.imei2 !== undefined) row.imei2 = cleanText(body.imei2) || null
  if (body.serial !== undefined) row.serial = cleanText(body.serial) || null

  if (body.purchase_value_cents !== undefined || body.purchase_value !== undefined) {
    row.purchase_value_cents = toCents(body.purchase_value_cents ?? body.purchase_value, !!body.purchase_value_cents)
  }
  if (body.wholesale_value_cents !== undefined || body.wholesale_value !== undefined) {
    row.wholesale_value_cents = toCents(body.wholesale_value_cents ?? body.wholesale_value, !!body.wholesale_value_cents)
  }
  if (body.expected_profit_wholesale_cents !== undefined || body.expected_profit_wholesale !== undefined) {
    row.expected_profit_wholesale_cents = toCents(
      body.expected_profit_wholesale_cents ?? body.expected_profit_wholesale,
      !!body.expected_profit_wholesale_cents,
    )
  }
  if (body.sale_value_cents !== undefined || body.sale_value !== undefined) {
    row.sale_value_cents = toCents(body.sale_value_cents ?? body.sale_value, !!body.sale_value_cents)
  }
  if (body.expected_profit_sale_cents !== undefined || body.expected_profit_sale !== undefined) {
    row.expected_profit_sale_cents = toCents(
      body.expected_profit_sale_cents ?? body.expected_profit_sale,
      !!body.expected_profit_sale_cents,
    )
  }

  if ('sold_for_cents' in body || 'sold_for' in body) {
    const raw = 'sold_for_cents' in body ? body.sold_for_cents : body.sold_for
    if (raw === null || raw === '') row.sold_for_cents = null
    else row.sold_for_cents = toCents(raw, !!body.sold_for_cents)
  }

  if (body.advertised !== undefined) row.advertised = Boolean(body.advertised)
  if (body.tested !== undefined) row.tested = Boolean(body.tested)
  if (body.label !== undefined) row.label = cleanText(body.label) || null
  if (body.sold !== undefined) row.sold = Boolean(body.sold)

  if (body.actual_profit_cents !== undefined || body.actual_profit !== undefined) {
    const val = body.actual_profit_cents ?? body.actual_profit
    row.actual_profit_cents =
      typeof val === 'number' ? Math.round(val) : toCents(val, false)
  }

  if (body.purchase_date !== undefined) row.purchase_date = toDate(body.purchase_date)
  if (body.sale_date !== undefined) row.sale_date = toDate(body.sale_date)

  if (body.payment_method_id !== undefined) {
    row.payment_method_id = body.payment_method_id ? parseOptionalUuid(body.payment_method_id) : null
  }
  if (body.payment_installments !== undefined) {
    const pi = body.payment_installments
    row.payment_installments = pi === null || pi === '' ? null : Number(pi) || null
  }
  if (body.buyer_name !== undefined) row.buyer_name = body.buyer_name ? cleanText(body.buyer_name) : null
  if (body.buyer_cpf !== undefined) row.buyer_cpf = body.buyer_cpf ? cleanText(body.buyer_cpf) : null
  if (body.sale_details !== undefined) row.sale_details = body.sale_details ? cleanText(body.sale_details) : null

  if (body.stock_type !== undefined) {
    const s = cleanText(body.stock_type).toLowerCase()
    if (s === 'seminovo' || s === 'lacrado') row.stock_type = s
  }

  if (body.sale_commission_user_id !== undefined) {
    row.sale_commission_user_id = body.sale_commission_user_id
      ? parseOptionalUuid(body.sale_commission_user_id)
      : null
  }

  if (body.image_url !== undefined) {
    const u = cleanText(body.image_url)
    row.image_url = u ? u.slice(0, 2048) : null
  }

  if (body.image_gallery_paths !== undefined) {
    const raw = body.image_gallery_paths
    if (Array.isArray(raw)) {
      const paths = raw
        .map((x) => cleanText(x))
        .filter(Boolean)
        .slice(0, 9)
      row.image_gallery_paths = paths
    }
  }

  if ('sale_payment_methods' in body) {
    const normalized = normalizeSalePaymentMethodsForPersistence(body.sale_payment_methods)
    if (normalized !== undefined) {
      row.sale_payment_methods = normalized
      if (normalized.length > 0) {
        row.payment_method_id = normalized[0].payment_method_id
        row.payment_installments = normalized[0].installments ?? 1
      } else {
        row.payment_method_id = null
        row.payment_installments = null
      }
    }
  }

  if (body.sold === false && Object.prototype.hasOwnProperty.call(body, 'payment_method_id') && body.payment_method_id === null) {
    row.sale_payment_methods = []
  }

  if (
    row.sold_for_cents != null
    && row.actual_profit_cents === undefined
    && (body.sold_for_cents !== undefined || body.sold_for !== undefined)
    && Array.isArray(body.costs)
  ) {
    const purchaseCents = (row.purchase_value_cents as number) ?? (existing.purchase_value_cents as number) ?? 0
    let costsTotal = 0
    for (const c of body.costs) {
      const co = c as Record<string, unknown>
      const vc = co.value_cents
      costsTotal += typeof vc === 'number' ? vc : toCents(co.value ?? vc) ?? 0
    }
    row.actual_profit_cents = (row.sold_for_cents as number) - purchaseCents - costsTotal
  }

  return row
}

async function loadDeviceWithCosts (supabase: PortalSupabase, deviceId: string) {
  const { data: device, error } = await supabase
    .from('resale_devices')
    .select(DEVICE_SELECT)
    .eq('id', deviceId)
    .maybeSingle()

  if (error || !device) return { device: null as Record<string, unknown> | null, error }

  const { data: costsData } = await supabase
    .from('resale_device_costs')
    .select('id, description, value_cents')
    .eq('resale_device_id', deviceId)

  const merged = { ...device, costs: costsData || [] }
  const enriched = await attachResaleDeviceDisplayImage(supabase, merged)

  return {
    device: enriched as Record<string, unknown>,
    error: null as null,
  }
}

async function rewriteResaleCostsKeepingBaseOnly (
  supabase: PortalSupabase,
  deviceId: string,
  organizationId: string,
) {
  const { data: cur } = await supabase
    .from('resale_device_costs')
    .select('description, value_cents')
    .eq('resale_device_id', deviceId)
  const keep = stripSaleDerivedCosts(cur || [])
  await supabase.from('resale_device_costs').delete().eq('resale_device_id', deviceId)
  for (const c of keep) {
    await supabase.from('resale_device_costs').insert({
      organization_id: organizationId,
      resale_device_id: deviceId,
      description: c.description,
      value_cents: c.value_cents ?? 0,
    })
  }
}

export async function GET (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const deviceId = parseOptionalUuid(rawId)
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const loaded = await loadDeviceWithCosts(auth.supabase, deviceId)
  if (!loaded.device) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    device: redactPurchaseValue(loaded.device, auth.isAdmin),
  })
}

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const deviceId = parseOptionalUuid(rawId)
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  if (!auth.isAdmin && hasPurchaseValueMutation(b)) {
    return NextResponse.json({ ok: false, error: 'purchase_value_forbidden' }, { status: 403 })
  }

  const { data: existingRow, error: fetchErr } = await auth.supabase
    .from('resale_devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!existingRow) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const existing = existingRow as Record<string, unknown>
  const wasSold = Boolean(existing.sold)
  const addonStockLines = parseAddonInventoryLines(b)
  if (!wasSold && b.sold === true && addonStockLines.length > 0) {
    const stockCheck = await validateAddonStockAvailable(auth.supabase, addonStockLines)
    if (stockCheck.ok === false) {
      if (stockCheck.reason === 'db_error') {
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }
      return NextResponse.json(
        {
          ok: false,
          error: 'stock_unavailable',
          productId: stockCheck.productId,
          requested: stockCheck.requested,
          available: stockCheck.available,
        },
        { status: 400 },
      )
    }
  }

  const row = buildPatchRow(b, existing)

  const RESALE_PHOTO_BUCKET = 'resale-device-photos'
  if (b.image_url !== undefined) {
    const newUrl = cleanText(b.image_url) || null
    const oldPath = (existing.image_storage_path as string | null | undefined)?.trim()
    if (newUrl && oldPath) {
      await auth.supabase.storage.from(RESALE_PHOTO_BUCKET).remove([oldPath])
      row.image_storage_path = null
    }
  }

  if (b.sold === false) {
    Object.assign(row, {
      sale_payment_methods: [],
      payment_method_id: null,
      payment_installments: null,
      sale_commission_user_id: null,
      actual_profit_cents: null,
    })
  }

  if (Object.keys(row).length === 0 && !Array.isArray(b.costs)) {
    const loaded = await loadDeviceWithCosts(auth.supabase, deviceId)
    if (!loaded.device) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, device: redactPurchaseValue(loaded.device, auth.isAdmin) })
  }

  if (
    row.sold_for_cents != null
    && row.actual_profit_cents === undefined
    && !Array.isArray(b.costs)
  ) {
    const { data: costs } = await auth.supabase
      .from('resale_device_costs')
      .select('value_cents')
      .eq('resale_device_id', deviceId)
    const purchaseCents = (row.purchase_value_cents as number) ?? (existing.purchase_value_cents as number) ?? 0
    const costsTotal = (costs || []).reduce((acc: number, c: { value_cents?: number }) => acc + (c.value_cents ?? 0), 0)
    row.actual_profit_cents = (row.sold_for_cents as number) - purchaseCents - costsTotal
  }

  if (Object.keys(row).length > 0) {
    const { error: upErr } = await auth.supabase
      .from('resale_devices')
      .update(row)
      .eq('id', deviceId)

    if (upErr) {
      console.error('[resale-devices PATCH]', upErr)
      return NextResponse.json({ ok: false, message: 'Não foi possível salvar.' }, { status: 500 })
    }
  }

  if (b.sold === false && !Array.isArray(b.costs)) {
    await rewriteResaleCostsKeepingBaseOnly(auth.supabase, deviceId, auth.organizationId)
  }

  if (Array.isArray(b.costs)) {
    await auth.supabase.from('resale_device_costs').delete().eq('resale_device_id', deviceId)
    for (const c of b.costs) {
      const co = c as Record<string, unknown>
      const value_cents =
        typeof co.value_cents === 'number'
          ? co.value_cents
          : toCents(co.value ?? co.value_cents) ?? 0
      await auth.supabase.from('resale_device_costs').insert({
        organization_id: auth.organizationId,
        resale_device_id: deviceId,
        description: cleanText(co.description) || null,
        value_cents,
      })
    }

    const soldForRaw = row.sold_for_cents ?? existing.sold_for_cents
    const soldFor =
      typeof soldForRaw === 'number' && Number.isFinite(soldForRaw) ? soldForRaw : null
    if (soldFor != null) {
      const purchaseCents = (row.purchase_value_cents as number) ?? (existing.purchase_value_cents as number) ?? 0
      const costsTotal = (b.costs as unknown[]).reduce<number>((acc, item) => {
        const co = item as Record<string, unknown>
        const vc = co.value_cents
        const line = typeof vc === 'number' ? vc : toCents(co.value ?? vc) ?? 0
        return acc + line
      }, 0)
      await auth.supabase
        .from('resale_devices')
        .update({ actual_profit_cents: soldFor - purchaseCents - costsTotal })
        .eq('id', deviceId)
    }
  }

  if (!wasSold && b.sold === true && addonStockLines.length > 0) {
    const ins = await insertStockExitsForResaleAddons({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      userId: auth.userId,
      deviceId,
      lines: addonStockLines,
    })
    if (!ins.ok) {
      return NextResponse.json({ ok: false, error: 'stock_movement_failed' }, { status: 500 })
    }
  }

  const loaded = await loadDeviceWithCosts(auth.supabase, deviceId)
  if (!loaded.device) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, device: redactPurchaseValue(loaded.device, auth.isAdmin) })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const deviceId = parseOptionalUuid(rawId)
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: before } = await auth.supabase
    .from('resale_devices')
    .select('image_storage_path, image_gallery_paths')
    .eq('id', deviceId)
    .maybeSingle()

  const b = before as { image_storage_path?: string | null; image_gallery_paths?: string[] | null } | null
  const photoPath = b?.image_storage_path?.trim()
  const extras = Array.isArray(b?.image_gallery_paths) ? b.image_gallery_paths.filter(Boolean) : []
  const toRemove = [photoPath, ...extras].filter(Boolean) as string[]
  if (toRemove.length > 0) {
    await auth.supabase.storage.from('resale-device-photos').remove(toRemove)
  }

  const { error } = await auth.supabase.from('resale_devices').delete().eq('id', deviceId)

  if (error) {
    console.error('[resale-devices DELETE]', error)
    return NextResponse.json({ ok: false, message: 'Não foi possível excluir.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
