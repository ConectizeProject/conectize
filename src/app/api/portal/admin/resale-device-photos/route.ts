import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  deleteSoldResaleDevicePhotos,
  keepOnlyFirstResaleDevicePhoto,
  listResaleDevicePhotosWithSizes,
} from '@/lib/seminovos/resale-device-photos-admin'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const photos = await listResaleDevicePhotosWithSizes(auth.supabase, auth.organizationId)
    return NextResponse.json({ ok: true, photos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed'
    console.error('[resale-device-photos GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = String(body?.action || '').trim()

  try {
    if (action === 'keep-first') {
      const result = await keepOnlyFirstResaleDevicePhoto(auth.supabase, auth.organizationId)
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'delete-sold') {
      const result = await deleteSoldResaleDevicePhotos(auth.supabase, auth.organizationId)
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'bulk_cleanup_failed'
    console.error('[resale-device-photos POST]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
