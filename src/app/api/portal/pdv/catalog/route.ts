import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get('q') || '').trim()
  const barcode = String(searchParams.get('barcode') || '').trim()

  let query = auth.supabase
    .from('products')
    .select('id, name, sku, barcode, sale_price_cents, cost_price_cents')
    .eq('organization_id', auth.organizationId)
    .eq('is_active', true)
    .eq('kind', 'product')
    .limit(40)
    .order('name', { ascending: true })

  if (barcode) {
    query = query.eq('barcode', barcode)
  } else if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  const ids = (data ?? []).map((row) => String(row.id))
  let stockById = new Map<string, number>()
  if (ids.length > 0) {
    const { data: stockRows } = await auth.supabase.rpc('portal_products_list_stock_summary', {
      p_product_ids: ids,
    })
    stockById = new Map((stockRows ?? []).map((row: { product_id: string, current_stock: number | string }) => {
      const raw = row.current_stock
      const n = typeof raw === 'number' ? raw : Number(raw)
      return [String(row.product_id), Number.isFinite(n) ? n : 0]
    }))
  }

  const products = (data ?? []).map((row) => ({
    ...row,
    stock: stockById.get(String(row.id)) ?? 0,
  }))

  return NextResponse.json({ ok: true, products })
}

