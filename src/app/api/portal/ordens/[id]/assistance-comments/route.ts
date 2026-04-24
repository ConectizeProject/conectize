import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const MAX_LEN = 6000

export async function GET (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: comments, error } = await auth.supabase
    .from('service_order_assistance_comments')
    .select('id, content, created_at, author_user_id, author_display_name')
    .eq('service_order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[assistance-comments GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    comments: comments ?? [],
    actorUserId: auth.userId,
    isAdmin: auth.isAdmin,
  })
}

export async function POST (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const orderId = parseOptionalUuid(rawId)
  if (!orderId) {
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

  const { error } = await auth.supabase.from('service_order_assistance_comments').insert({
    service_order_id: orderId,
    organization_id: auth.organizationId,
    author_user_id: auth.userId,
    author_display_name: auth.authorDisplayName,
    content,
  })

  if (error) {
    console.error('[assistance-comments POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
