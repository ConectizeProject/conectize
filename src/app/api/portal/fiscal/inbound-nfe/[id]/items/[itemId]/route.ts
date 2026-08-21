import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { linkInboundNfeItem } from '@/lib/fiscal/inbound-nfe'

type Params = { params: Promise<{ id: string, itemId: string }> }

export async function PATCH (request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id, itemId } = await params
  const body = await request.json().catch(() => null) as { productId?: string | null } | null
  const productIdRaw = body?.productId
  const productId = productIdRaw === null || productIdRaw === undefined || productIdRaw === ''
    ? null
    : String(productIdRaw)

  const result = await linkInboundNfeItem(auth, String(id || ''), String(itemId || ''), productId)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 400
    return NextResponse.json({
      ok: false,
      error: result.error,
      message: 'message' in result ? result.message : 'Não foi possível vincular o item.',
    }, { status })
  }
  return NextResponse.json({ ok: true, document: result.document })
}
