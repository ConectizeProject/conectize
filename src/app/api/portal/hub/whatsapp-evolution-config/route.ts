import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import {
  evolutionHubDisplayLabel,
  isLikelyEvolutionApiKey,
  type WhatsappEvolutionHubMetadata,
  WHATSAPP_EVOLUTION_PLATFORM_ID,
} from '@/lib/whatsapp/evolution-hub-config'
import { getSupabaseHubWriter } from '@/lib/supabase/hub-writes'
import {
  loadHubInboxAccessMeta,
  replaceHubInboxViewers,
} from '@/lib/whatsapp/hub-connection-inbox-access'

const PLATFORM = WHATSAPP_EVOLUTION_PLATFORM_ID

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

  const { data: rows } = await auth.supabase
    .from('hub_connections')
    .select('id, access_token, metadata, created_at')
    .eq('platform_id', PLATFORM)
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: true })

  const mapped = (rows || [])
    .map((r) => {
      const meta = (r.metadata as WhatsappEvolutionHubMetadata) || {}
      const instanceName = String(meta.instance_name || '').trim()
      if (!instanceName) return null
      const token = r.access_token as string | null
      const masked =
        token && token.length > 6 ? `${token.slice(0, 4)}…${token.slice(-4)}` : null
      return {
        connection_id: r.id as string,
        instance_name: instanceName,
        label: String(meta.label || '').trim() || null,
        display_label: evolutionHubDisplayLabel(meta),
        preferred_for_messages: meta.preferred_for_messages === true,
        api_base_url_override: String(meta.api_base_url_override || ''),
        automation_enabled: meta.automation_enabled === true,
        access_token_masked: masked,
        created_at: r.created_at,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  const instances = await Promise.all(
    mapped.map(async (inst) => {
      const inbox = await loadHubInboxAccessMeta(auth.supabase, inst.connection_id)
      return {
        ...inst,
        inbox_restricted: inbox.restricted,
        inbox_viewer_user_ids: inbox.viewer_user_ids,
        inbox_viewers: inbox.viewers,
      }
    }),
  )

  const base = publicBaseUrl()
  const webhookUrl = base ? `${base}/api/webhooks/whatsapp-evolution` : ''

  return NextResponse.json({
    ok: true,
    instances,
    connected: instances.length > 0,
    uses_env_api_base: Boolean(process.env.WHATSAPP_EVOLUTION_API_URL?.trim()),
    webhook_url: webhookUrl,
    env_api_key_fallback: Boolean(process.env.WHATSAPP_EVOLUTION_API_KEY?.trim()),
    webhook_secret_configured:
      Boolean(process.env.WHATSAPP_EVOLUTION_WEBHOOK_SECRET?.trim()),
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

  const connectionId = String(body.connection_id || body.connectionId || '').trim()
  const instanceName = String(body.instance_name || body.instanceName || '').trim()
  const label = String(body.label || '').trim()
  const preferredForMessages =
    body.preferred_for_messages === true || body.preferredForMessages === true
  const automationEnabled =
    body.automation_enabled === true || body.automationEnabled === true
  const apiKey = String(body.api_key || body.apiKey || '').trim()
  const apiBaseOverride = String(body.api_base_url_override || body.apiBaseUrlOverride || '').trim()
  const inboxAccess = body.inbox_access as {
    unrestricted?: unknown
    viewer_user_ids?: unknown
  } | undefined

  if (!instanceName) {
    return NextResponse.json({ ok: false, error: 'instance_name_required' }, { status: 400 })
  }

  if (apiKey && !isLikelyEvolutionApiKey(apiKey)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_api_key',
        hint: 'Use a mesma AUTHENTICATION_API_KEY da Evolution (string curta, sem espaços).',
      },
      { status: 400 },
    )
  }

  const envKey = Boolean(process.env.WHATSAPP_EVOLUTION_API_KEY?.trim())
  if (!apiKey && !envKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_key_required',
        hint: 'Defina WHATSAPP_EVOLUTION_API_KEY no servidor ou informe api_key ao salvar.',
      },
      { status: 400 },
    )
  }

  const { data: existing } = connectionId
    ? await auth.supabase
        .from('hub_connections')
        .select('id, metadata, access_token')
        .eq('id', connectionId)
        .eq('platform_id', PLATFORM)
        .eq('organization_id', auth.organizationId)
        .maybeSingle()
    : { data: null }

  if (connectionId && !existing) {
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
  }

  const prevMeta = (existing?.metadata as Record<string, unknown>) || {}

  const metadata: WhatsappEvolutionHubMetadata & Record<string, unknown> = {
    ...prevMeta,
    instance_name: instanceName,
    preferred_for_messages: preferredForMessages,
    automation_enabled: automationEnabled,
  }

  if (label) metadata.label = label
  else delete (metadata as { label?: unknown }).label

  if (apiBaseOverride) metadata.api_base_url_override = apiBaseOverride
  else delete (metadata as { api_base_url_override?: unknown }).api_base_url_override

  const hubWriter = await getSupabaseHubWriter(auth.supabase)

  if (preferredForMessages) {
    const { data: others } = await hubWriter
      .from('hub_connections')
      .select('id, metadata')
      .eq('platform_id', PLATFORM)
      .eq('organization_id', auth.organizationId)

    for (const o of others || []) {
      if (o.id === existing?.id) continue
      const om = (o.metadata as WhatsappEvolutionHubMetadata) || {}
      if (om.preferred_for_messages !== true) continue
      await hubWriter
        .from('hub_connections')
        .update({
          metadata: { ...om, preferred_for_messages: false },
          updated_at: new Date().toISOString(),
        })
        .eq('id', o.id)
    }
  }

  const row: Record<string, unknown> = {
    platform_id: PLATFORM,
    organization_id: auth.organizationId,
    metadata,
    updated_at: new Date().toISOString(),
  }

  if (apiKey) {
    row.access_token = apiKey
  } else if (
    existing?.access_token &&
    isLikelyEvolutionApiKey(String(existing.access_token))
  ) {
    row.access_token = existing.access_token
  } else {
    row.access_token = null
  }

  let data: { id: string } | null = null
  let error: { message?: string; code?: string } | null = null

  if (existing) {
    const res = await hubWriter
      .from('hub_connections')
      .update(row)
      .eq('id', existing.id)
      .eq('organization_id', auth.organizationId)
      .select('id')
      .single()
    data = res.data
    error = res.error
  } else {
    const res = await hubWriter
      .from('hub_connections')
      .insert({
        ...row,
        created_by: auth.userId,
        api_key: null,
        refresh_token: null,
        token_expires_at: null,
      })
      .select('id')
      .single()
    data = res.data
    error = res.error
  }

  if (error) {
    const msg = String(error.message || '')
    if (
      msg.includes('hub_connections_org_evolution_instance_uidx')
      || msg.includes('duplicate key') && msg.includes('instance_name')
    ) {
      return NextResponse.json(
        { ok: false, error: 'instance_name_already_used' },
        { status: 409 },
      )
    }
    if (msg.includes('hub_connections_platform_user_uniq')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'migration_required',
          hint:
            'O banco ainda limita uma conexão Evolution por organização. Rode: npx supabase@2.20.12 db push (migration 20260521150000).',
        },
        { status: 409 },
      )
    }
    const rlsHint = msg.includes('policy') || msg.includes('permission')
      ? ' Sem permissão RLS: confirme admin da organização ou configure SUPABASE_SERVICE_ROLE_KEY no .env.'
      : ''
    return NextResponse.json(
      {
        ok: false,
        error: 'db_error',
        hint: (msg || 'Falha ao salvar no banco. Rode as migrations pendentes (db push).') + rlsHint,
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
    const filtered = viewerIds.filter((id) => allowed.has(id))

    const savedViewers = await replaceHubInboxViewers(
      hubWriter,
      auth.organizationId,
      savedId,
      filtered,
    )
    if (!savedViewers.ok) {
      return NextResponse.json({
        ok: true,
        connection: data,
        inbox_access_warning: 'instance_saved_viewers_failed',
      })
    }
  }

  return NextResponse.json({ ok: true, connection: data })
}
