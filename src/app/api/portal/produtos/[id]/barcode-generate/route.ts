import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { fiscalGtinOrNull } from '@/lib/fiscal/gtin'
import { getBlingConnectionForCurrentUser } from '@/lib/integrations/bling/api'
import { generateEan13 } from '@/lib/products/generate-ean13'
import { getProductById } from '@/lib/products/service'
import { updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'

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

  const productRes = await getProductById(id)
  if (!productRes.ok || !('product' in productRes)) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }

  const product = productRes.product
  if (product.barcode) {
    return NextResponse.json({ ok: true, product, syncedToBling: false, shouldSyncToBling: false })
  }

  const body = await request.json().catch(() => ({})) as { barcode?: unknown }
  const requested = fiscalGtinOrNull(body?.barcode)
  const nextBarcode = requested && requested.length === 13 ? requested : generateEan13()

  const hub = await getBlingConnectionForCurrentUser()
  const hubConnected = hub.ok === true

  const updateRes = await updateProductAndSyncBling(id, { barcode: nextBarcode }, {
    preserveBlingSyncState: !hubConnected,
  })
  if (!updateRes.ok) {
    const error = 'error' in updateRes ? updateRes.error : 'db_error'
    const message = 'message' in updateRes ? updateRes.message : undefined
    return NextResponse.json({ ok: false, error, message }, { status: 400 })
  }

  const shouldSyncToBling = hubConnected && Boolean(updateRes.product.blingId)
  return NextResponse.json({
    ok: true,
    product: updateRes.product,
    syncedToBling: false,
    shouldSyncToBling,
  })
}
