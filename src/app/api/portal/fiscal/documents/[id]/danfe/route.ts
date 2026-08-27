import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { buildNfceDanfeHtml } from '@/lib/fiscal/nfce-danfe'
import { buildNfeDanfePdf } from '@/lib/fiscal/nfe-danfe'

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

  const { data: doc } = await auth.supabase
    .from('fiscal_documents')
    .select('model')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .maybeSingle()

  if (String(doc?.model || '') === '55') {
    const result = await buildNfeDanfePdf(auth, fiscalDocumentId)
    if (!result.pdf) {
      return NextResponse.json({ ok: false, error: 'danfe_unavailable' }, { status: result.status })
    }
    const download = request.nextUrl.searchParams.get('download') === '1'
    const filename = result.filename || 'DANFE-NFe.pdf'
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
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
