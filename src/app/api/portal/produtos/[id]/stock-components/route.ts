import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { persistVirtualProductCostFromComponents } from '@/lib/products/virtual-stock-cost'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

type Params = Promise<{ id: string }>

type ComponentBodyRow = {
  componentProductId?: string
  quantityPerUnit?: number
}

export async function GET (
  _request: Request,
  { params }: { params: Params },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const productId = parseOptionalUuid(rawId)
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: product, error: productError } = await auth.supabase
    .from('products')
    .select('id, sku, name')
    .eq('organization_id', auth.organizationId)
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data, error } = await auth.supabase
    .from('product_stock_components')
    .select('id, component_product_id, quantity_per_unit, products:component_product_id (id, sku, name, cost_price_cents)')
    .eq('organization_id', auth.organizationId)
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) {
    if (/product_stock_components|schema cache|does not exist/i.test(error.message)) {
      return NextResponse.json({ ok: true, product, components: [] })
    }
    console.error('[stock-components GET]', error.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const components = (data ?? []).map((row) => {
    const linked = Array.isArray((row as { products?: unknown }).products)
      ? (row as { products: unknown[] }).products[0]
      : (row as { products?: unknown }).products
    const linkedRow = linked && typeof linked === 'object'
      ? linked as { id?: string, sku?: string | null, name?: string | null, cost_price_cents?: number | null }
      : null
    const costRaw = Number(linkedRow?.cost_price_cents)
    return {
      id: String((row as { id?: string }).id || ''),
      componentProductId: String((row as { component_product_id?: string }).component_product_id || ''),
      quantityPerUnit: Math.max(1, Number((row as { quantity_per_unit?: number }).quantity_per_unit) || 1),
      componentSku: linkedRow?.sku ? String(linkedRow.sku) : null,
      componentName: linkedRow?.name ? String(linkedRow.name) : null,
      componentCostCents: Number.isFinite(costRaw) ? Math.max(0, Math.round(costRaw)) : 0,
    }
  })

  return NextResponse.json({ ok: true, product, components })
}

export async function PUT (
  request: Request,
  { params }: { params: Params },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const productId = parseOptionalUuid(rawId)
  if (!productId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const rows = Array.isArray(body?.components) ? body.components as ComponentBodyRow[] : null
  if (!rows) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const { data: product, error: productError } = await auth.supabase
    .from('products')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const normalized: Array<{ componentProductId: string, quantityPerUnit: number }> = []
  const seen = new Set<string>()
  for (const row of rows) {
    const componentProductId = parseOptionalUuid(row?.componentProductId)
    const quantityPerUnit = Math.trunc(Number(row?.quantityPerUnit) || 0)
    if (!componentProductId || quantityPerUnit <= 0) {
      return NextResponse.json({ ok: false, error: 'invalid_component' }, { status: 400 })
    }
    if (componentProductId === productId) {
      return NextResponse.json({ ok: false, error: 'self_component' }, { status: 400 })
    }
    if (seen.has(componentProductId)) continue
    seen.add(componentProductId)
    normalized.push({ componentProductId, quantityPerUnit })
  }

  if (normalized.length > 0) {
    const componentIds = normalized.map((row) => row.componentProductId)
    const [{ data: components }, { data: nested }] = await Promise.all([
      auth.supabase
        .from('products')
        .select('id')
        .eq('organization_id', auth.organizationId)
        .in('id', componentIds),
      auth.supabase
        .from('product_stock_components')
        .select('product_id')
        .eq('organization_id', auth.organizationId)
        .in('product_id', componentIds),
    ])

    if ((components ?? []).length !== componentIds.length) {
      return NextResponse.json({ ok: false, error: 'component_not_found' }, { status: 400 })
    }
    if ((nested ?? []).length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'nested_virtual_not_allowed',
        message: 'Componente não pode ser outro produto com estoque virtual.',
      }, { status: 400 })
    }
  }

  const { error: deleteError } = await auth.supabase
    .from('product_stock_components')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('product_id', productId)

  if (deleteError) {
    console.error('[stock-components PUT delete]', deleteError.message)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (normalized.length > 0) {
    const { error: insertError } = await auth.supabase
      .from('product_stock_components')
      .insert(normalized.map((row) => ({
        organization_id: auth.organizationId,
        product_id: productId,
        component_product_id: row.componentProductId,
        quantity_per_unit: row.quantityPerUnit,
      })))

    if (insertError) {
      console.error('[stock-components PUT insert]', insertError.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
  }

  const persisted = normalized.length > 0
    ? await persistVirtualProductCostFromComponents({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      productId,
    })
    : { ok: true as const, isVirtual: false, costPriceCents: null }

  return NextResponse.json({
    ok: true,
    count: normalized.length,
    isVirtual: persisted.isVirtual,
    costPriceCents: persisted.costPriceCents,
  })
}
