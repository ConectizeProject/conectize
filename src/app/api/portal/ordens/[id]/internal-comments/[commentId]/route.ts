import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) return { ok: false as const, status: 401, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') {
    return { ok: false as const, status: 403, error: 'forbidden' }
  }

  return { ok: true as const, supabase, actorUserId: user.id, isAdmin: normalizedRole === 'admin' }
}

async function requireCommentAccess(orderId: string, commentId: string) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return { ok: false as const, status: auth.status, error: auth.error }

  const { data: comment, error } = await auth.supabase
    .from('service_order_internal_comments')
    .select('id, author_user_id')
    .eq('service_order_id', orderId)
    .eq('id', commentId)
    .maybeSingle()

  if (error) return { ok: false as const, status: 500, error: 'db_error' }
  if (!comment) return { ok: false as const, status: 404, error: 'not_found' }

  const canEdit = auth.isAdmin || comment.author_user_id === auth.actorUserId
  if (!canEdit) return { ok: false as const, status: 403, error: 'forbidden' }

  return { ok: true as const, auth, comment }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const body = await request.json().catch(() => null)
  const nextContent = String(body?.content || '').trim()
  if (!nextContent) return NextResponse.json({ ok: false, error: 'content_required' }, { status: 400 })
  if (nextContent.length > 6000) return NextResponse.json({ ok: false, error: 'content_too_long' }, { status: 400 })

  const { id: orderId, commentId } = await params
  if (!orderId || !commentId) return NextResponse.json({ ok: false, error: 'ids_required' }, { status: 400 })

  const access = await requireCommentAccess(orderId, commentId)
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { error } = await access.auth.supabase
    .from('service_order_internal_comments')
    .update({ content: nextContent })
    .eq('id', commentId)
    .eq('service_order_id', orderId)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id: orderId, commentId } = await params
  if (!orderId || !commentId) return NextResponse.json({ ok: false, error: 'ids_required' }, { status: 400 })

  const access = await requireCommentAccess(orderId, commentId)
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { error } = await access.auth.supabase
    .from('service_order_internal_comments')
    .delete()
    .eq('id', commentId)
    .eq('service_order_id', orderId)

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
