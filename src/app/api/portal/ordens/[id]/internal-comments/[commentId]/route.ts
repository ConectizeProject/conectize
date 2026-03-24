import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const MAX_LEN = 6000

export async function PATCH (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawOrderId, commentId: rawCommentId } = await params
  const orderId = parseOptionalUuid(rawOrderId)
  const commentId = parseOptionalUuid(rawCommentId)
  if (!orderId || !commentId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const content = String((body as { content?: unknown })?.content ?? '').trim()
  if (!content) {
    return NextResponse.json({ ok: false, error: 'content_required' }, { status: 400 })
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: 'content_too_long' }, { status: 400 })
  }

  const { data: row, error: findErr } = await auth.supabase
    .from('service_order_internal_comments')
    .select('id')
    .eq('id', commentId)
    .eq('service_order_id', orderId)
    .maybeSingle()

  if (findErr || !row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { error } = await auth.supabase
    .from('service_order_internal_comments')
    .update({ content })
    .eq('id', commentId)
    .eq('service_order_id', orderId)

  if (error) {
    console.error('[internal-comments PATCH]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawOrderId, commentId: rawCommentId } = await params
  const orderId = parseOptionalUuid(rawOrderId)
  const commentId = parseOptionalUuid(rawCommentId)
  if (!orderId || !commentId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('service_order_internal_comments')
    .delete()
    .eq('id', commentId)
    .eq('service_order_id', orderId)

  if (error) {
    console.error('[internal-comments DELETE]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
