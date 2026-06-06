import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import {
  assertInboxChannelAccess,
  fetchInboxConversationsPage,
  loadInboxChannelMetas,
} from '@/lib/whatsapp/whatsapp-inbox-channels'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')?.trim() || ''
  const channelId = searchParams.get('channel_id')?.trim() || ''
  const kindRaw = searchParams.get('kind')?.trim() || 'contacts'
  const kind = kindRaw === 'groups' ? 'groups' : 'contacts'
  const q = searchParams.get('q')?.trim() || ''
  const cursor = searchParams.get('cursor')?.trim() || null
  const limitRaw = Number.parseInt(searchParams.get('limit') || '', 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
    : DEFAULT_LIMIT

  if (scope === 'channels' || !channelId) {
    const channels = await loadInboxChannelMetas({
      supabase: auth.supabase,
      organizationId: auth.organizationId,
      userId: auth.userId,
      isAdmin: auth.isAdmin,
    })
    return NextResponse.json({ ok: true, channels })
  }

  const access = await assertInboxChannelAccess({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    userId: auth.userId,
    isAdmin: auth.isAdmin,
    channelId,
  })

  if (access.ok === false) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 404 })
  }

  const page = await fetchInboxConversationsPage({
    supabase: auth.supabase,
    organizationId: auth.organizationId,
    channelId,
    kind,
    limit,
    cursor,
    q,
  })

  return NextResponse.json({
    ok: true,
    channel: access.meta,
    kind,
    ...page,
  })
}
