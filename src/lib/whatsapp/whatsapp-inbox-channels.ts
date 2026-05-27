import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evolutionHubDisplayLabel,
  type WhatsappEvolutionHubMetadata,
} from '@/lib/whatsapp/evolution-hub-config'
import {
  loadHubInboxViewerIndex,
  userCanViewHubInbox,
} from '@/lib/whatsapp/hub-connection-inbox-access'

export type InboxChannelMeta = {
  channel_id: string
  channel_type: 'evolution' | 'cloud' | 'legacy'
  label: string
  instance_name: string | null
  hub_connection_id: string | null
}

export type InboxConversationRow = {
  id: string
  wa_from: string
  hub_connection_id: string | null
  last_message_at: string
  needs_staff_attention: boolean
  draft_os: Record<string, string> | null
  state?: {
    display_name?: string
    is_group?: boolean
    evolution_instance?: string
  } | null
  service_order_id: string | null
  last_preview: string | null
  service_orders?: { display_number: number | null } | null
}

const CONV_SELECT = `
  id,
  wa_from,
  hub_connection_id,
  last_message_at,
  needs_staff_attention,
  draft_os,
  state,
  service_order_id,
  created_at,
  service_orders ( display_number )
`

export function isLegacyChannelId (channelId: string): boolean {
  return channelId === 'legacy' || channelId.startsWith('evo-legacy:')
}

export async function loadInboxChannelMetas (opts: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  isAdmin: boolean
}): Promise<InboxChannelMeta[]> {
  const viewerIndex = await loadHubInboxViewerIndex(
    opts.supabase,
    opts.organizationId,
  )
  const canViewHub = (hubId: string | null) =>
    userCanViewHubInbox(hubId, viewerIndex, opts.userId, opts.isAdmin)

  const channels: InboxChannelMeta[] = []

  const { data: evolutionHubs } = await opts.supabase
    .from('hub_connections')
    .select('id, metadata')
    .eq('platform_id', 'whatsapp_evolution')
    .eq('organization_id', opts.organizationId)
    .order('created_at', { ascending: true })

  for (const h of evolutionHubs || []) {
    const hid = String(h.id)
    if (!canViewHub(hid)) continue
    const meta = (h.metadata as WhatsappEvolutionHubMetadata) || {}
    const instanceName = String(meta.instance_name || '').trim()
    if (!instanceName) continue
    channels.push({
      channel_id: hid,
      channel_type: 'evolution',
      label: evolutionHubDisplayLabel(meta),
      instance_name: instanceName,
      hub_connection_id: hid,
    })
  }

  const { data: cloudHub } = await opts.supabase
    .from('hub_connections')
    .select('id')
    .eq('platform_id', 'whatsapp_business')
    .eq('organization_id', opts.organizationId)
    .maybeSingle()

  if (cloudHub?.id && canViewHub(String(cloudHub.id))) {
    channels.push({
      channel_id: String(cloudHub.id),
      channel_type: 'cloud',
      label: 'WhatsApp oficial',
      instance_name: null,
      hub_connection_id: String(cloudHub.id),
    })
  }

  const { data: legacyRows } = await opts.supabase
    .from('whatsapp_conversations')
    .select('state')
    .eq('organization_id', opts.organizationId)
    .is('hub_connection_id', null)
    .limit(500)

  const legacyInstances = new Set<string>()
  let hasPlainLegacy = false
  for (const row of legacyRows || []) {
    const st = (row.state as { evolution_instance?: string } | null) || {}
    const inst = String(st.evolution_instance || '').trim()
    if (inst) legacyInstances.add(inst.toLowerCase())
    else hasPlainLegacy = true
  }

  for (const inst of [...legacyInstances].sort()) {
    channels.push({
      channel_id: `evo-legacy:${inst}`,
      channel_type: 'evolution',
      label: inst,
      instance_name: inst,
      hub_connection_id: null,
    })
  }

  if (hasPlainLegacy) {
    channels.push({
      channel_id: 'legacy',
      channel_type: 'legacy',
      label: 'Sem instância vinculada',
      instance_name: null,
      hub_connection_id: null,
    })
  }

  return channels
}

function applySearchFilter<T extends {
  wa_from: string
  last_preview: string | null
  state?: { display_name?: string } | null
}> (rows: T[], q: string): T[] {
  const query = q.trim().toLowerCase()
  if (!query) return rows
  const qDigits = query.replace(/\D/g, '')
  return rows.filter((r) => {
    const label = String(r.state?.display_name || '').toLowerCase()
    const wa = r.wa_from.toLowerCase()
    const preview = String(r.last_preview || '').toLowerCase()
    const waDigits = r.wa_from.replace(/\D/g, '')
    if (label.includes(query) || wa.includes(query) || preview.includes(query)) {
      return true
    }
    return qDigits.length >= 3 && waDigits.includes(qDigits)
  })
}

async function fetchConversationRows (opts: {
  supabase: SupabaseClient
  organizationId: string
  channelId: string
  kind: 'contacts' | 'groups'
  limit: number
  cursor: string | null
}): Promise<Array<Record<string, unknown>>> {
  let query = opts.supabase
    .from('whatsapp_conversations')
    .select(`${CONV_SELECT}, last_message_preview`)
    .eq('organization_id', opts.organizationId)
    .order('last_message_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(opts.limit)

  if (opts.kind === 'groups') {
    query = query.ilike('wa_from', '%@g.us')
  } else {
    query = query.not('wa_from', 'ilike', '%@g.us')
  }

  if (opts.channelId === 'legacy') {
    query = query.is('hub_connection_id', null)
  } else if (opts.channelId.startsWith('evo-legacy:')) {
    const inst = opts.channelId.slice('evo-legacy:'.length)
    query = query
      .is('hub_connection_id', null)
      .ilike('state->>evolution_instance', inst)
  } else {
    query = query.eq('hub_connection_id', opts.channelId)
  }

  if (opts.cursor) {
    query = query.lt('last_message_at', opts.cursor)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as Array<Record<string, unknown>>
}

function mapConversationRow (row: Record<string, unknown>): InboxConversationRow {
  const previewRaw = row.last_message_preview
  return {
    id: String(row.id),
    wa_from: String(row.wa_from),
    hub_connection_id: row.hub_connection_id ? String(row.hub_connection_id) : null,
    last_message_at: String(row.last_message_at),
    needs_staff_attention: row.needs_staff_attention === true,
    draft_os: (row.draft_os as Record<string, string> | null) || null,
    state: (row.state as InboxConversationRow['state']) || null,
    service_order_id: row.service_order_id ? String(row.service_order_id) : null,
    last_preview:
      typeof previewRaw === 'string' && previewRaw.trim()
        ? previewRaw.trim()
        : null,
    service_orders: row.service_orders as InboxConversationRow['service_orders'],
  }
}

export async function fetchInboxConversationsPage (opts: {
  supabase: SupabaseClient
  organizationId: string
  channelId: string
  kind: 'contacts' | 'groups'
  limit: number
  cursor: string | null
  q: string
}): Promise<{
  conversations: InboxConversationRow[]
  has_more: boolean
  next_cursor: string | null
}> {
  const pageSize = Math.min(50, Math.max(1, opts.limit))
  const fetchLimit = opts.q.trim() ? Math.min(200, pageSize * 5) : pageSize + 1

  const rows = await fetchConversationRows({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    kind: opts.kind,
    limit: fetchLimit,
    cursor: opts.cursor,
  })

  let mapped = rows.map(mapConversationRow)
  mapped = applySearchFilter(mapped, opts.q)

  const hasMore = opts.q.trim()
    ? mapped.length > pageSize || rows.length === fetchLimit
    : rows.length > pageSize

  const conversations = mapped.slice(0, pageSize)
  const nextCursor =
    conversations.length > 0
      ? conversations[conversations.length - 1].last_message_at
      : null

  return {
    conversations,
    has_more: hasMore,
    next_cursor: hasMore ? nextCursor : null,
  }
}

export async function assertInboxChannelAccess (opts: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  isAdmin: boolean
  channelId: string
}): Promise<{ ok: true; meta: InboxChannelMeta } | { ok: false; error: string }> {
  const channels = await loadInboxChannelMetas({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    userId: opts.userId,
    isAdmin: opts.isAdmin,
  })
  const meta = channels.find((c) => c.channel_id === opts.channelId)
  if (!meta) return { ok: false, error: 'channel_not_found' }
  return { ok: true, meta }
}
