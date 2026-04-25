import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { applyImageUrlToActiveVariations } from '@/lib/products/service'

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

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
  }

  const raw = body.imageUrl
  const imageUrl =
    raw === null || raw === undefined
      ? null
      : typeof raw === 'string'
        ? raw.trim() || null
        : null

  const result = await applyImageUrlToActiveVariations(id, imageUrl)
  if (result.ok === false) {
    const status =
      result.error === 'not_authenticated'
        ? 401
        : result.error === 'not_found'
          ? 404
          : result.error === 'not_a_parent'
            ? 400
            : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    updatedCount: result.updatedCount,
  })
}
