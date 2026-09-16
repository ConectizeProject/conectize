import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

type ProductStamp = {
  updated_at?: string | null
}

function buildCatalogEtag (latestUpdatedAt: string | null, count: number) {
  if (!latestUpdatedAt) return null
  return `${latestUpdatedAt}|${count}`
}

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const id = String(searchParams.get('id') || '').trim()
  const idsRaw = String(searchParams.get('ids') || '').trim()
  const ids = idsRaw
    ? [...new Set(
      idsRaw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)),
    )].slice(0, 40)
    : []
  const q = String(searchParams.get('q') || '').trim()
  const barcode = String(searchParams.get('barcode') || '').trim()
  const snapshot = searchParams.get('snapshot') === '1'
  // Busca leve: sem RPC de estoque (estoque só quando id=/ids= ou include_stock=1).
  const includeStock = !snapshot && (
    id.length > 0
    || ids.length > 0
    || searchParams.get('include_stock') === '1'
  )
  const limit = snapshot
    ? 3000
    : (id || ids.length || barcode || q ? Math.max(10, ids.length || 0) : 40)

  const sinceRaw = String(searchParams.get('since') || '').trim()
  const ifNoneMatch = String(request.headers.get('If-None-Match') || '')
    .replace(/^W\//, '')
    .replace(/"/g, '')
    .trim()
  const clientTag = sinceRaw || ifNoneMatch

  if (snapshot && clientTag) {
    const [{ data: stampRows }, { count }] = await Promise.all([
      auth.supabase
        .from('products')
        .select('updated_at')
        .eq('organization_id', auth.organizationId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1),
      auth.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', auth.organizationId)
        .eq('is_active', true),
    ])
    const latestUpdatedAt = String((stampRows?.[0] as ProductStamp | undefined)?.updated_at || '') || null
    const productCount = typeof count === 'number' ? count : 0
    const etag = buildCatalogEtag(latestUpdatedAt, productCount)
    if (
      etag
      && (clientTag === etag || (latestUpdatedAt != null && clientTag === latestUpdatedAt))
    ) {
      return NextResponse.json({
        ok: true,
        not_modified: true,
        updated_at: latestUpdatedAt,
        etag,
        count: productCount,
      }, {
        headers: { ETag: `"${etag}"` },
      })
    }
  }

  let query = auth.supabase
    .from('products')
    .select('id, name, sku, barcode, sale_price_cents, cost_price_cents, image_url, kind, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('is_active', true)
    .limit(limit)
    .order('name', { ascending: true })

  if (!snapshot) {
    if (id) {
      query = query.eq('id', id)
    } else if (ids.length > 0) {
      query = query.in('id', ids)
    } else if (barcode) {
      query = query.eq('barcode', barcode)
    } else if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const stockIds = (data ?? [])
    .filter((row) => row.kind !== 'service')
    .map((row) => String(row.id))
  let stockById = new Map<string, number>()
  if (includeStock && stockIds.length > 0) {
    const { data: stockRows } = await auth.supabase.rpc('portal_products_list_stock_summary', {
      p_product_ids: stockIds,
    })
    stockById = new Map((stockRows ?? []).map((row: { product_id: string, current_stock: number | string }) => {
      const raw = row.current_stock
      const n = typeof raw === 'number' ? raw : Number(raw)
      return [String(row.product_id), Number.isFinite(n) ? n : 0]
    }))
  }

  let latestUpdatedAt: string | null = null
  const products = (data ?? []).map((row) => {
    const updatedAt = String((row as ProductStamp).updated_at || '')
    if (updatedAt && (!latestUpdatedAt || updatedAt > latestUpdatedAt)) {
      latestUpdatedAt = updatedAt
    }
    const { updated_at: _updatedAt, ...rest } = row as Record<string, unknown>
    return {
      ...rest,
      stock: row.kind === 'service'
        ? null
        : (includeStock ? (stockById.get(String(row.id)) ?? 0) : null),
    }
  })

  let etag: string | null = null
  if (snapshot) {
    const { count } = await auth.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', auth.organizationId)
      .eq('is_active', true)
    etag = buildCatalogEtag(latestUpdatedAt, typeof count === 'number' ? count : products.length)
  }

  return NextResponse.json({
    ok: true,
    products,
    snapshot: snapshot || undefined,
    truncated: snapshot ? products.length >= limit : undefined,
    updated_at: snapshot ? latestUpdatedAt : undefined,
    etag: etag || undefined,
  }, {
    headers: etag ? { ETag: `"${etag}"` } : undefined,
  })
}
