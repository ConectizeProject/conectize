import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  deleteResaleDevicePhoto,
  type ResaleDevicePhotoKind,
} from '@/lib/seminovos/resale-device-photos-admin'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

function parsePhotoKind (value: string | null): ResaleDevicePhotoKind | null {
  if (value === 'cover' || value === 'gallery') return value
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

  const { photoId } = await params
  const searchParams = new URL(request.url).searchParams
  const deviceId = parseOptionalUuid(searchParams.get('deviceId'))
  const kind = parsePhotoKind(searchParams.get('kind'))

  if (!photoId || !deviceId || !kind) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  try {
    await deleteResaleDevicePhoto(auth.supabase, auth.organizationId, deviceId, photoId, kind)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed'
    if (message === 'not_found' || message === 'invalid_id') {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    console.error('[resale-device-photos DELETE]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
