import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'
import { isManualQuoteStatus } from '@/lib/quotes/quote-status'

export async function PATCH (
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

  const body = await request.json().catch(() => null)
  const status = typeof body === 'object' && body && 'status' in body
    ? String((body as { status: unknown }).status ?? '').trim()
    : ''

  if (!status || !isManualQuoteStatus(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await auth.supabase
    .from('quotes')
    .select('id, status')
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (existing.status === 'convertido') {
    return NextResponse.json({ ok: false, error: 'already_converted' }, { status: 409 })
  }

  const { error } = await auth.supabase
    .from('quotes')
    .update({ status })
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE (
  _request: NextRequest,
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

  const { error } = await auth.supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId)
    .eq('organization_id', auth.organizationId)

  if (error) {
    console.error('[quotes delete]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
