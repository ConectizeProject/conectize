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

  const authorDisplayName = String(appUser?.full_name || appUser?.email || '').trim() || '(Sem nome)'
  const isAdmin = normalizedRole === 'admin'
  return { ok: true as const, supabase, authorDisplayName, actorUserId: user.id, isAdmin }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('service_order_internal_comments')
    .select('id, content, created_at, author_display_name, author_user_id')
    .eq('service_order_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    comments: data || [],
    actorUserId: auth.actorUserId,
    isAdmin: auth.isAdmin,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const content = String(body?.content || '').trim()
  if (!content) return NextResponse.json({ ok: false, error: 'content_required' }, { status: 400 })
  if (content.length > 6000) return NextResponse.json({ ok: false, error: 'content_too_long' }, { status: 400 })

  const { data: inserted, error } = await auth.supabase
    .from('service_order_internal_comments')
    .insert({
      service_order_id: id,
      author_user_id: auth.actorUserId,
      author_display_name: auth.authorDisplayName,
      content,
    })
    .select('id, content, created_at, author_display_name')
    .single()

  if (error) return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, comment: inserted })
}
