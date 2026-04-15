import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { suggestedSaleCents } from '@/lib/pricing/suggested-sale-cents'

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
  const p_retailer_user_id = parseUuidParam(url.searchParams.get('retailerUserId'))

  /** Lista operacional: um dispositivo obrigatório; sem modelo não retorna linhas. */
  if (!p_device_model_id) {
    return NextResponse.json({ ok: true, items: [] })
  }

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

  const rows = ((rpcRows ?? []) as RpcRow[]).filter(
    (r) => r.pricing_tag_id != null && r.device_model_id != null,
  )
  const productIds = [...new Set(rows.map((r) => r.product_id))]

  const costById = new Map<string, number | null>()
  if (productIds.length > 0) {
    const CHUNK = 120
    for (let i = 0; i < productIds.length; i += CHUNK) {
      const chunk = productIds.slice(i, i + CHUNK)
      const { data: prodRows, error: pErr } = await auth.supabase
        .from('products')
        .select('id, cost_price_cents')
        .in('id', chunk)

      if (pErr) {
        console.error('[staff/tabela-precos products]', pErr)
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      for (const p of prodRows ?? []) {
        const row = p as { id: string; cost_price_cents?: number | null }
        costById.set(
          row.id,
          typeof row.cost_price_cents === 'number' ? row.cost_price_cents : null,
        )
      }
    }
  }

  const tagIds = [...new Set(rows.map((r) => r.pricing_tag_id).filter(Boolean))] as string[]

  const overrideByTagId = new Map<
    string,
    { margin_bps: number; min_suggested_sale_cents: number | null }
  >()

  if (p_retailer_user_id && tagIds.length > 0) {
    const CHUNK = 80
    for (let i = 0; i < tagIds.length; i += CHUNK) {
      const chunk = tagIds.slice(i, i + CHUNK)
      const { data: ovs, error: oErr } = await auth.supabase
        .from('pricing_tag_retailer_overrides')
        .select('pricing_tag_id, margin_bps, min_suggested_sale_cents')
        .eq('retailer_user_id', p_retailer_user_id)
        .in('pricing_tag_id', chunk)

      if (oErr) {
        console.error('[staff/tabela-precos overrides]', oErr)
        return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
      }

      for (const o of ovs ?? []) {
        const row = o as {
          pricing_tag_id: string
          margin_bps?: number | null
          min_suggested_sale_cents?: number | null
        }
        const mb = typeof row.margin_bps === 'number' ? row.margin_bps : 0
        const minC =
          typeof row.min_suggested_sale_cents === 'number' ? row.min_suggested_sale_cents : null
        overrideByTagId.set(row.pricing_tag_id, {
          margin_bps: mb,
          min_suggested_sale_cents: minC,
        })
      }
    }
  }

  const items = rows.map((r) => {
    const costPriceCents = costById.get(r.product_id) ?? null
    const tagId = r.pricing_tag_id
    let vendaLojistaCents: number | null = null
    if (
      p_retailer_user_id
      && tagId
      && overrideByTagId.has(tagId)
    ) {
      const ov = overrideByTagId.get(tagId)!
      vendaLojistaCents = suggestedSaleCents({
        costCents: costPriceCents,
        marginBps: ov.margin_bps,
        minSuggestedSaleCents: ov.min_suggested_sale_cents,
      })
    }

    return {
      productId: r.product_id,
      productName: r.product_name,
      productKind: r.product_kind,
      salePriceCents: r.sale_price_cents,
      costPriceCents,
      suggestedSaleCents: r.suggested_sale_cents,
      vendaLojistaCents,
      pricingTagId: r.pricing_tag_id,
      pricingTagName: r.pricing_tag_name,
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
