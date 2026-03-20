import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { isPortalFieldForBling } from '@/lib/products/bling-sync'
import { syncProductToBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

export async function POST (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    portalFieldsChanged?: unknown
  }
  const portalFieldsChanged = Array.isArray(body.portalFieldsChanged)
    ? body.portalFieldsChanged.filter(isPortalFieldForBling)
    : undefined

  const result = await syncProductToBling(
    id,
    portalFieldsChanged !== undefined
      ? { portalFieldsChanged }
      : undefined,
  )
  if (!result.ok && 'error' in result) {
    const status = result.error === 'bling_request_failed' ? 502 : 400
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: result.message,
    }, { status })
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    product: result.product,
    syncedToBling: result.syncedToBling,
    pendingSyncToBling: result.product.blingSyncPending,
  })
}
