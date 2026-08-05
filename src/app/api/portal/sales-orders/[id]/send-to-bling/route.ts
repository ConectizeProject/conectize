import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { pushSalesOrderToBling } from '@/lib/integrations/bling/push-sales-order'

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id', message: 'ID inválido' }, { status: 400 })
  }

  const result = await pushSalesOrderToBling(auth, orderId)
  if (!result.ok) {
    const status =
      result.error === 'order_not_found'
        ? 404
        : result.error === 'order_not_paid' || result.error === 'order_canceled' || result.error === 'products_missing_bling_id' || result.error === 'no_items'
          ? 400
          : result.error === 'bling_not_connected' || result.error === 'not_authenticated'
            ? 400
            : 502

    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status }
    )
  }

  return NextResponse.json({
    ok: true,
    bling_pedido_id: result.blingPedidoId,
    bling_nfce_id: result.blingNfceId,
    pedido_url: result.pedidoUrl,
    nfce_url: result.nfceUrl,
    preferred_url: result.preferredUrl,
    already_synced: result.alreadySynced,
    nfce_generated: result.nfceGenerated,
    nfce_error: result.nfceError,
  })
}
