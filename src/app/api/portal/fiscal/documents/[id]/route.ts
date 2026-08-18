import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

export async function GET (
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

  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, environment, series, number, access_key, sales_order_id, status, protocol, qr_code_url, sefaz_status_code, sefaz_status_message, authorized_at, canceled_at, created_at, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: data,
    danfe_url: data.status === 'authorized'
      ? `/api/portal/fiscal/documents/${encodeURIComponent(data.id)}/danfe`
      : null,
  })
}
