import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { emitNfceForSalesOrder } from '@/lib/fiscal/emit-nfce'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { getSalesOrderNfceState } = await import('@/lib/fiscal/emit-nfce')
  const fiscalDocument = await getSalesOrderNfceState(auth, orderId)

  return NextResponse.json({
    ok: true,
    fiscal_document: fiscalDocument,
    danfe_url: fiscalDocument?.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/danfe`
      : null,
  })
}

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const result = await emitNfceForSalesOrder(auth, orderId)
  if (result.ok === false) {
    const status = result.error === 'order_not_found'
      ? 404
      : result.error === 'sefaz_error'
        ? 502
        : 400
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status },
    )
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: result.fiscalDocument,
    already_authorized: result.alreadyAuthorized,
    danfe_url: result.printedUrl,
  })
}
