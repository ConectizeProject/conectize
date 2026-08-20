import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { loadNfceXmlDownload } from '@/lib/fiscal/nfce-xml'

export const runtime = 'nodejs'

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

  const result = await loadNfceXmlDownload(auth, fiscalDocumentId)
  if (!result.xml || !result.filename) {
    const error = result.status === 409 ? 'xml_unavailable' : 'xml_not_found'
    const message = result.status === 409
      ? 'Só é possível baixar o XML de nota autorizada ou cancelada.'
      : 'O XML desta nota ainda não está gravado. Notas antigas podem não ter o arquivo.'
    return NextResponse.json({ ok: false, error, message }, { status: result.status })
  }

  return new NextResponse(result.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
