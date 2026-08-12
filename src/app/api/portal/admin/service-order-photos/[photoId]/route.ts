import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  deleteServiceOrderPhoto,
  type ServiceOrderPhotoKind,
} from '@/lib/orders/service-order-photos-admin'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function parsePhotoKind (value: string | null): ServiceOrderPhotoKind | null {
  if (value === 'entry' || value === 'exit' || value === 'assistance') return value
  return null
}

export async function DELETE (
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { photoId: rawPhotoId } = await params
  const photoId = parseOptionalUuid(rawPhotoId)
  if (!photoId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const kind = parsePhotoKind(new URL(request.url).searchParams.get('kind'))
  if (!kind) {
    return NextResponse.json({ ok: false, error: 'invalid_kind' }, { status: 400 })
  }

  try {
    await deleteServiceOrderPhoto(auth.supabase, auth.organizationId, photoId, kind)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed'
    if (message === 'not_found') {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    console.error('[service-order-photos DELETE]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
