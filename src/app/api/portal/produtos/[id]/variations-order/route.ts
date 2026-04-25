import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { reorderProductVariations } from '@/lib/products/service'

type Params = Promise<{ id: string }>

export async function POST (
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as { variationIds?: unknown } | null
  const variationIds = Array.isArray(body?.variationIds)
    ? body?.variationIds.map((x) => String(x || '').trim()).filter(Boolean)
    : []

  if (variationIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'variationIds_invalid' }, { status: 400 })
  }

  const reordered = await reorderProductVariations(id, variationIds)
  if (reordered.ok === false) {
    const status =
      reordered.error === 'not_authenticated'
        ? 401
        : reordered.error === 'parent_not_found'
          ? 404
          : 400
    return NextResponse.json({ ok: false, error: reordered.error }, { status })
  }

  return NextResponse.json({ ok: true, variations: reordered.variations })
}

