import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { cancelNfceDocument } from '@/lib/fiscal/emit-nfce'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST (
  request: NextRequest,
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

  const body = await request.json().catch(() => null)
  const justification = String(body?.justification || '')
  const result = await cancelNfceDocument(auth, fiscalDocumentId, justification)
  if (result.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status: result.error === 'not_found' ? 404 : result.error === 'sefaz_error' ? 502 : 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    fiscal_document: result.fiscalDocument,
  })
}
