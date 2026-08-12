import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { getSupabaseHubWriter } from '@/lib/supabase/hub-writes'
import {
  loadHubInboxAccessMeta,
  replaceHubInboxViewers,
} from '@/lib/whatsapp/hub-connection-inbox-access'

const PLATFORM = 'whatsapp_business'

function publicBaseUrl (): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim()
  if (!u) return ''
  if (u.startsWith('http')) return u.replace(/\/$/, '')
  return `https://${u.replace(/\/$/, '')}`
}

export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data } = await auth.supabase
    .from('hub_connections')
    .select('id, access_token, metadata, created_at')
    .eq('platform_id', PLATFORM)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  const meta = (data?.metadata as Record<string, unknown>) || {}
  const token = data?.access_token as string | null | undefined
  const masked =
    token && token.length > 6 ? `${token.slice(0, 4)}…${token.slice(-4)}` : null

  const base = publicBaseUrl()
  const webhookUrl = base ? `${base}/api/webhooks/whatsapp` : ''

  const connectionId = data?.id ? String(data.id) : null
  const inbox = connectionId
    ? await loadHubInboxAccessMeta(auth.supabase, connectionId)
    : { restricted: false, viewer_user_ids: [], viewers: [] }

  return NextResponse.json({
    ok: true,
    connection_id: connectionId,
    connected: !!data?.id && !!token,
    inbox_restricted: inbox.restricted,
    inbox_viewer_user_ids: inbox.viewer_user_ids,
    inbox_viewers: inbox.viewers,
    phone_number_id: String(meta.phone_number_id || ''),
    waba_id: String(meta.waba_id || ''),
    automation_enabled: meta.automation_enabled === true,
    verify_token_configured: Boolean(String(meta.verify_token || '').trim()),
    access_token_masked: masked,
    webhook_url: webhookUrl,
  })
}

export async function POST (request: Request) {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const phoneNumberId = String(body.phone_number_id || body.phoneNumberId || '').trim()
  const wabaId = String(body.waba_id || body.wabaId || '').trim()
  const accessToken = String(body.access_token || body.accessToken || '').trim()
  const verifyToken = String(body.verify_token || body.verifyToken || '').trim()
  const automationEnabled = body.automation_enabled === true || body.automationEnabled === true
  const inboxAccess = body.inbox_access as {
    unrestricted?: unknown
    viewer_user_ids?: unknown
  } | undefined

  if (!phoneNumberId) {
    return NextResponse.json({ ok: false, error: 'phone_number_id_required' }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from('hub_connections')
    .select('metadata, access_token')
    .eq('platform_id', PLATFORM)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  const prevMeta = (existing?.metadata as Record<string, unknown>) || {}
  const metadata: Record<string, unknown> = {
    ...prevMeta,
    phone_number_id: phoneNumberId,
    automation_enabled: automationEnabled,
  }
  if (wabaId) metadata.waba_id = wabaId
  if (verifyToken) metadata.verify_token = verifyToken

  const row: Record<string, unknown> = {
    platform_id: PLATFORM,
    organization_id: auth.organizationId,
    metadata,
    updated_at: new Date().toISOString(),
  }

  if (accessToken) {
    row.access_token = accessToken
  } else if (existing?.access_token) {
    row.access_token = existing.access_token
  } else {
    return NextResponse.json({ ok: false, error: 'access_token_required' }, { status: 400 })
  }

  if (!existing) {
    row.created_by = auth.userId
    row.api_key = null
    row.refresh_token = null
    row.token_expires_at = null
  }

  const hubWriter = await getSupabaseHubWriter(auth.supabase)

  let data: { id: string; platform_id: string } | null = null
  let error: { message?: string } | null = null

  if (existing) {
    const res = await hubWriter
      .from('hub_connections')
      .update(row)
      .eq('platform_id', PLATFORM)
      .eq('organization_id', auth.organizationId)
      .select('id, platform_id')
      .single()
    data = res.data
    error = res.error
  } else {
    const res = await hubWriter
      .from('hub_connections')
      .insert(row)
      .select('id, platform_id')
      .single()
    data = res.data
    error = res.error
  }

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'db_error',
        hint: String(error.message || ''),
      },
      { status: 500 },
    )
  }

  const savedId = data?.id
  if (savedId && inboxAccess) {
    let viewerIds: string[] = []
    if (inboxAccess.unrestricted === true) {
      viewerIds = []
    } else if (Array.isArray(inboxAccess.viewer_user_ids)) {
      viewerIds = inboxAccess.viewer_user_ids.map((x) => String(x)).filter(Boolean)
    }
    const { data: members } = await hubWriter
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', auth.organizationId)
      .in('role_in_org', ['admin', 'staff'])
    const allowed = new Set((members || []).map((m) => String(m.user_id)))
    await replaceHubInboxViewers(
      hubWriter,
      auth.organizationId,
      savedId,
      viewerIds.filter((id) => allowed.has(id)),
    )
  }

  return NextResponse.json({ ok: true, connection: data })
}

export async function DELETE () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { error } = await auth.supabase
    .from('hub_connections')
    .delete()
    .eq('platform_id', PLATFORM)
    .eq('organization_id', auth.organizationId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
