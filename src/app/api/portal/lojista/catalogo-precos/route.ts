import { NextRequest, NextResponse } from 'next/server'
import { requireRetailer } from '@/lib/auth/portal-api'

function parseUuidParam (raw: string | null): string | null {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) return null
  return v
}

/**
 * Catálogo comercial (lojista): preço de lista e sugerido, **sem custo**.
 * Dados via RPC `portal_retailer_catalog_prices` (margem / mínimo com overrides do lojista).
 */
export async function GET (request: NextRequest) {
  const auth = await requireRetailer()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const p_brand_id = parseUuidParam(url.searchParams.get('brandId'))
  const p_device_type_id = parseUuidParam(url.searchParams.get('deviceTypeId'))
  const p_device_model_id = parseUuidParam(url.searchParams.get('deviceModelId'))

  const { data, error } = await auth.supabase.rpc('portal_retailer_catalog_prices', {
    p_brand_id,
    p_device_type_id,
    p_device_model_id,
  })

  if (error) {
    console.error('[lojista/catalogo-precos]', error)
    const message = process.env.NODE_ENV === 'development' ? error.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }

  type RpcRow = {
    product_id: string
    product_name: string
    product_kind: string
    sale_price_cents: number | null
    suggested_sale_cents: number | null
    pricing_tag_id: string | null
    pricing_tag_name: string | null
    device_model_id: string | null
    device_model_label: string | null
    device_type_id: string | null
    device_type_name: string | null
    brand_id: string | null
    brand_name: string | null
  }

  const rows = (data ?? []) as RpcRow[]
  const items = rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    productKind: r.product_kind,
    salePriceCents: r.sale_price_cents,
    suggestedSaleCents: r.suggested_sale_cents,
    pricingTagId: r.pricing_tag_id,
    pricingTagName: r.pricing_tag_name,
    deviceModelId: r.device_model_id,
    deviceModelLabel: r.device_model_label,
    deviceTypeId: r.device_type_id,
    deviceTypeName: r.device_type_name,
    brandId: r.brand_id,
    brandName: r.brand_name,
  }))

  return NextResponse.json({ ok: true, items })
}
