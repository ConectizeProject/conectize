import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { enrichWhatsappMessagesWithMediaUrls } from '@/lib/whatsapp/enrich-whatsapp-message-media-urls'

const DEFAULT_MSG_LIMIT = 20
const MAX_MSG_LIMIT = 50

export async function GET (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const { data: conv } = await auth.supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!conv) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = Number.parseInt(searchParams.get('limit') || '', 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_MSG_LIMIT, Math.max(1, limitRaw))
    : DEFAULT_MSG_LIMIT
  const includeMedia = searchParams.get('media') !== '0'
  const before = searchParams.get('before')?.trim() || null

  let query = auth.supabase
    .from('whatsapp_messages')
    .select(
      'id, direction, body, status, resolved_by, needs_human, wa_message_id, created_at, deleted_at, payload',
    )
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: messages, error } = await query

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const batch = messages || []
  const hasMore = batch.length > limit
  const page = hasMore ? batch.slice(0, limit) : batch
  const chronological = [...page].reverse()
  const oldest = chronological[0]

  const enriched = await enrichWhatsappMessagesWithMediaUrls(
    auth.supabase,
    chronological as Array<Record<string, unknown>>,
    { includeMediaUrls: includeMedia },
  )

  return NextResponse.json({
    ok: true,
    messages: enriched,
    has_more: hasMore,
    next_before: hasMore && oldest ? String(oldest.created_at) : null,
  })
}
