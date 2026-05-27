import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getSupabaseHubWriter } from '@/lib/supabase/hub-writes'
import {
  assertHubConnectionAdmin,
  loadHubInboxAccessMeta,
  replaceHubInboxViewers,
} from '@/lib/whatsapp/hub-connection-inbox-access'

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { connectionId } = await params
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const hubCheck = await assertHubConnectionAdmin(
    auth.supabase,
    auth.organizationId,
    connectionId,
  )
  if (!hubCheck.ok) {
    return NextResponse.json({ ok: false, error: hubCheck.error }, { status: 404 })
  }

  const meta = await loadHubInboxAccessMeta(auth.supabase, connectionId)

  return NextResponse.json({
    ok: true,
    connection_id: connectionId,
    restricted: meta.restricted,
    viewer_user_ids: meta.viewer_user_ids,
    viewers: meta.viewers,
    can_edit: true,
  })
}

export async function PUT (
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { connectionId } = await params
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })
  }

  const hubCheck = await assertHubConnectionAdmin(
    auth.supabase,
    auth.organizationId,
    connectionId,
  )
  if (!hubCheck.ok) {
    return NextResponse.json({ ok: false, error: hubCheck.error }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as {
    viewer_user_ids?: unknown
    unrestricted?: unknown
  } | null

  let userIds: string[] = []
  if (body?.unrestricted === true) {
    userIds = []
  } else if (Array.isArray(body?.viewer_user_ids)) {
    userIds = body.viewer_user_ids.map((x) => String(x)).filter(Boolean)
  }

  const { data: members } = await auth.supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', auth.organizationId)
    .in('role_in_org', ['admin', 'staff'])

  const allowed = new Set((members || []).map((m) => String(m.user_id)))
  const filtered = userIds.filter((id) => allowed.has(id))

  const hubWriter = await getSupabaseHubWriter(auth.supabase)

  const saved = await replaceHubInboxViewers(
    hubWriter,
    auth.organizationId,
    connectionId,
    filtered,
  )

  if (!saved.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: saved.error,
        hint: 'Tabela hub_connection_inbox_viewers ausente? Execute npx supabase db push.',
      },
      { status: 500 },
    )
  }

  const meta = await loadHubInboxAccessMeta(auth.supabase, connectionId)

  return NextResponse.json({
    ok: true,
    restricted: meta.restricted,
    viewer_user_ids: meta.viewer_user_ids,
    viewers: meta.viewers,
  })
}
