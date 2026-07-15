import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { listServiceOrderPhotosWithSizes } from '@/lib/orders/service-order-photos-admin'

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const photos = await listServiceOrderPhotosWithSizes(auth.supabase, auth.organizationId)
    return NextResponse.json({ ok: true, photos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed'
    console.error('[service-order-photos GET]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
