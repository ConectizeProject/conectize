import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { emitFiscalDocumentForSalesOrder } from '@/lib/fiscal/emit-nfce'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const fiscalDocumentId = parseOptionalUuid(rawId)
  if (!fiscalDocumentId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: doc, error } = await auth.supabase
    .from('fiscal_documents')
    .select('sales_order_id, status, model')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!doc?.sales_order_id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (doc.status === 'authorized') {
    return NextResponse.json({ ok: false, error: 'already_authorized' }, { status: 400 })
  }

  const model = String(doc.model) === '55' ? '55' : '65'
  const result = await emitFiscalDocumentForSalesOrder(auth, String(doc.sales_order_id), model)
  if (result.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        message: result.message,
        needs_correction: result.needsCorrection === true,
        fiscal_document: result.fiscalDocument ?? null,
      },
      { status: result.error === 'sefaz_error' || result.error === 'sefaz_timeout' || result.error === 'sefaz_denied' ? 502 : 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: result.fiscalDocument,
    danfe_url: result.printedUrl,
    xml_url: result.printedUrl
      ? `/api/portal/fiscal/documents/${encodeURIComponent(result.fiscalDocument.id)}/xml`
      : null,
  })
}
