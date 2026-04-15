import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { isPortalFieldForBling } from '@/lib/products/bling-sync'
import { syncProductToBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

export async function POST (
  request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
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
