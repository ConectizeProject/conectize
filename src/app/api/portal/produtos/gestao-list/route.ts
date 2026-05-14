import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  GESTAO_LIST_CHUNK,
  enrichGestaoRawRowsToProductRows,
  fetchGestaoListRawSlice,
} from '@/lib/products/portal-gestao-produtos-list'

export async function GET (request: NextRequest) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = request.nextUrl
  const q = String(searchParams.get('q') || '').trim()
  const kindParam = String(searchParams.get('kind') || '').trim().toLowerCase()
  const kindFilter: 'product' | 'service' | 'all' =
    kindParam === 'service' ? 'service' : kindParam === 'product' ? 'product' : 'all'
  const sku = String(searchParams.get('sku') || '').trim()
  const barcode = String(searchParams.get('barcode') || '').trim()

  const offset = Math.max(0, Math.floor(Number(searchParams.get('offset')) || 0))
  const rawLimit = Math.floor(Number(searchParams.get('limit')) || GESTAO_LIST_CHUNK)
  const limit = Math.min(GESTAO_LIST_CHUNK, Math.max(1, rawLimit))

  const supabase = auth.supabase
  const slice = await fetchGestaoListRawSlice(supabase, {
    query: q,
    kindFilter,
    offset,
    limit,
    sku,
    barcode,
  })

  if (slice.hasSearchButNoValidTokens) {
    return NextResponse.json({
      ok: true,
      items: [],
      totalCount: 0,
      hasSearchButNoValidTokens: true,
      listLoadError: false,
    })
  }

  if (slice.listLoadError) {
    return NextResponse.json({ ok: false, error: 'list_load_error' }, { status: 500 })
  }

  const items = await enrichGestaoRawRowsToProductRows(supabase, slice.flatRows)

  return NextResponse.json({
    ok: true,
    items,
    totalCount: slice.totalCount,
    hasSearchButNoValidTokens: false,
    listLoadError: false,
  })
}
