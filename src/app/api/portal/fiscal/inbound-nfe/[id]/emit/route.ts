import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { emitNfeForInbound, getInboundNfeState } from '@/lib/fiscal/emit-nfce'

type Params = { params: Promise<{ id: string }> }

export async function GET (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  const fiscalDocument = await getInboundNfeState(auth, String(id || ''))
  return NextResponse.json({
    ok: true,
    fiscal_document: fiscalDocument,
    danfe_url: fiscalDocument?.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/danfe`
      : null,
    xml_url: fiscalDocument?.status === 'authorized' || fiscalDocument?.status === 'canceled'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(fiscalDocument.id)}/xml`
      : null,
  })
}

export async function POST (_request: Request, { params }: Params) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  const result = await emitNfeForInbound(auth, String(id || ''))
  if (result.ok === false) {
    return NextResponse.json(result, {
      status: result.error === 'inbound_not_found' ? 404 : 400,
    })
  }
  return NextResponse.json({
    ...result,
    danfe_url: `/api/portal/fiscal/documents/${encodeURIComponent(result.fiscalDocument.id)}/danfe`,
    xml_url: `/api/portal/fiscal/documents/${encodeURIComponent(result.fiscalDocument.id)}/xml`,
  })
}
