import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildNfceDanfeHtml } from '@/lib/fiscal/nfce-danfe'

export const runtime = 'nodejs'

export async function GET (
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

  const preview = request.nextUrl.searchParams.get('preview') === '1'
  const result = await buildNfceDanfeHtml(auth, fiscalDocumentId, { autoPrint: !preview })
  if (!result.html) {
    return NextResponse.json({ ok: false, error: 'danfe_unavailable' }, { status: result.status })
  }

  return new NextResponse(result.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
