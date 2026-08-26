import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { requestOriginFromNext } from '@/lib/quotes/fetch-quote-for-print-html'

export async function GET (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const quoteId = parseOptionalUuid(rawId)
  if (!quoteId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: row, error } = await auth.supabase
    .from('quotes')
    .select('share_token')
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[quote share-link]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let token = row.share_token as string | null
  if (!token) {
    token = randomUUID()
    const { error: upErr } = await auth.supabase
      .from('quotes')
      .update({ share_token: token })
      .eq('id', quoteId)
    if (upErr) {
      console.error('[quote share-link]', upErr)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
  }

  const origin = requestOriginFromNext(request)
  const url = `${origin}/orcamento/${token}`
  return NextResponse.json({ ok: true, url })
}
