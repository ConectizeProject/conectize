import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

function parseUuidParam (raw: string | null): string | null {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) return null
  return v
}

type RpcRow = {
  product_id: string
  product_name: string
  product_kind: string
  sale_price_cents: number | null
  suggested_sale_cents: number | null
  pricing_tag_id: string | null
  pricing_tag_name: string | null
  parts_family: string | null
  device_model_id: string | null
  device_model_label: string | null
  device_type_id: string | null
  device_type_name: string | null
  brand_id: string | null
  brand_name: string | null
}

/**
 * Tabela de preços **operacional** (staff/admin): mesma base do catálogo comercial,
 * mais SKU e custo (`cost_price_cents`) carregados em lote — nunca exposto na rota lojista.
 */
export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const p_brand_id = parseUuidParam(url.searchParams.get('brandId'))
  const p_device_type_id = parseUuidParam(url.searchParams.get('deviceTypeId'))
  const p_device_model_id = parseUuidParam(url.searchParams.get('deviceModelId'))

  const { data: rpcRows, error: rpcError } = await auth.supabase.rpc('portal_retailer_catalog_prices', {
    p_brand_id,
    p_device_type_id,
    p_device_model_id,
  })

  if (rpcError) {
    console.error('[staff/tabela-precos rpc]', rpcError)
    const message = process.env.NODE_ENV === 'development' ? rpcError.message : 'db_error'
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }

  const rows = (rpcRows ?? []) as RpcRow[]
  const productIds = [...new Set(rows.map((r) => r.product_id))]

  const costSkuById = new Map<string, { sku: string | null; costPriceCents: number | null }>()
  if (productIds.length > 0) {
    const CHUNK = 120
    for (let i = 0; i < productIds.length; i += CHUNK) {
      const chunk = productIds.slice(i, i + CHUNK)
      const { data: prodRows, error: pErr } = await auth.supabase
        .from('products')
        .select('id, sku, cost_price_cents')
        .in('id', chunk)

      if (pErr) {
        console.error('[staff/tabela-precos products]', pErr)
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      for (const p of prodRows ?? []) {
        const row = p as { id: string; sku?: string | null; cost_price_cents?: number | null }
        costSkuById.set(row.id, {
          sku: row.sku != null ? String(row.sku) : null,
          costPriceCents: typeof row.cost_price_cents === 'number' ? row.cost_price_cents : null,
        })
      }
    }
  }

  const items = rows.map((r) => {
    const extra = costSkuById.get(r.product_id)
    return {
      productId: r.product_id,
      productName: r.product_name,
      productKind: r.product_kind,
      sku: extra?.sku ?? null,
      salePriceCents: r.sale_price_cents,
      costPriceCents: extra?.costPriceCents ?? null,
      suggestedSaleCents: r.suggested_sale_cents,
      pricingTagId: r.pricing_tag_id,
      pricingTagName: r.pricing_tag_name,
      partsFamily: r.parts_family,
      deviceModelId: r.device_model_id,
      deviceModelLabel: r.device_model_label,
      deviceTypeId: r.device_type_id,
      deviceTypeName: r.device_type_name,
      brandId: r.brand_id,
      brandName: r.brand_name,
    }
  })

  return NextResponse.json({ ok: true, items })
}
