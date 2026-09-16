import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const RECENT_ORDERS = 100
const DEFAULT_LIMIT = 5

function parseLimit (raw: string | null): number {
  const n = Number(raw || DEFAULT_LIMIT)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(40, Math.max(1, Math.round(n)))
}

/**
 * IDs leves para sugestões no picker da OS:
 * 1) serviço mais usado nas OS recentes
 * 2) produtos/serviços compatíveis com o deviceModelId
 */
export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const deviceModelId = parseOptionalUuid(searchParams.get('deviceModelId'))
  const limit = parseLimit(searchParams.get('limit'))

  const productIds: string[] = []
  const seen = new Set<string>()

  function pushId (id: string | null | undefined) {
    const v = String(id || '').trim()
    if (!v || seen.has(v)) return
    if (productIds.length >= limit) return
    seen.add(v)
    productIds.push(v)
  }

  const { data: recentOrders, error: ordersError } = await auth.supabase
    .from('service_orders')
    .select('services')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(RECENT_ORDERS)

  if (ordersError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const qtyByServiceId = new Map<string, number>()
  for (const row of recentOrders ?? []) {
    const services = (row as { services?: unknown }).services
    const items = Array.isArray(services)
      ? services
      : (services && typeof services === 'object' && Array.isArray((services as { items?: unknown }).items)
        ? (services as { items: unknown[] }).items
        : [])

    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const rec = item as { kind?: unknown, sourceProductId?: unknown, quantity?: unknown }
      if (rec.kind === 'product') continue
      const sourceProductId = parseOptionalUuid(rec.sourceProductId)
      if (!sourceProductId) continue
      const qtyRaw = Number(rec.quantity)
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.trunc(qtyRaw) : 1
      qtyByServiceId.set(sourceProductId, (qtyByServiceId.get(sourceProductId) || 0) + qty)
    }
  }

  const topServiceId = Array.from(qtyByServiceId.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id)[0] ?? null

  if (topServiceId) {
    const { data: topProduct } = await auth.supabase
      .from('products')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('id', topServiceId)
      .eq('is_active', true)
      .maybeSingle()

    if (topProduct?.id) pushId(String(topProduct.id))
  }

  if (deviceModelId && productIds.length < limit) {
    const { data: compatRows, error: compatError } = await auth.supabase
      .from('product_compatible_device_models')
      .select('product_id')
      .eq('organization_id', auth.organizationId)
      .eq('device_model_id', deviceModelId)
      .limit(80)

    if (compatError) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    const candidateIds = [...new Set(
      (compatRows ?? [])
        .map((row) => String((row as { product_id?: string }).product_id || '').trim())
        .filter(Boolean),
    )].filter((id) => !seen.has(id))

    if (candidateIds.length > 0) {
      const { data: products, error: productsError } = await auth.supabase
        .from('products')
        .select('id, name')
        .eq('organization_id', auth.organizationId)
        .eq('is_active', true)
        .in('id', candidateIds)
        .order('name', { ascending: true })
        .limit(limit)

      if (productsError) {
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      for (const product of products ?? []) {
        pushId(String((product as { id?: string }).id || ''))
        if (productIds.length >= limit) break
      }
    }
  }

  return NextResponse.json({ ok: true, productIds })
}
