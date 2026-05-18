import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { evolutionHubDisplayLabel } from '@/lib/whatsapp/evolution-hub-config'

type ConvRow = {
  id: string
  wa_from: string
  customer_id: string | null
  hub_connection_id: string | null
  last_message_at: string
  needs_staff_attention: boolean
  draft_os: unknown
  state: unknown
  service_order_id: string | null
  created_at: string
  service_orders?: { display_number: number | null } | null
}

export async function GET () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data: rows, error } = await auth.supabase
    .from('whatsapp_conversations')
    .select(
      `
      id,
      wa_from,
      customer_id,
      hub_connection_id,
      last_message_at,
      needs_staff_attention,
      draft_os,
      state,
      service_order_id,
      created_at,
      service_orders ( display_number )
    `,
    )
    .order('last_message_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const list = (rows || []) as ConvRow[]
  const ids = list.map((r) => r.id)
  let lastBodies: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: msgs } = await auth.supabase
      .from('whatsapp_messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
    const seen = new Set<string>()
    for (const m of msgs || []) {
      const cid = m.conversation_id as string
      if (seen.has(cid)) continue
      seen.add(cid)
      lastBodies[cid] = String(m.body || '').slice(0, 280)
    }
  }

  const withPreview = list.map((r) => ({
    ...r,
    last_preview: lastBodies[r.id] || null,
  }))

  const hubIds = [
    ...new Set(
      withPreview
        .map((c) => c.hub_connection_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const hubMeta = new Map<
    string,
    { platform_id: string; label: string; instance_name: string | null }
  >()

  if (hubIds.length > 0) {
    const { data: hubs } = await auth.supabase
      .from('hub_connections')
      .select('id, platform_id, metadata')
      .in('id', hubIds)

    for (const h of hubs || []) {
      const meta = (h.metadata as Record<string, unknown>) || {}
      if (h.platform_id === 'whatsapp_evolution') {
        hubMeta.set(String(h.id), {
          platform_id: 'whatsapp_evolution',
          label: evolutionHubDisplayLabel(meta as { instance_name?: string; label?: string }),
          instance_name: String(meta.instance_name || '') || null,
        })
      } else if (h.platform_id === 'whatsapp_business') {
        hubMeta.set(String(h.id), {
          platform_id: 'whatsapp_business',
          label: 'WhatsApp oficial',
          instance_name: null,
        })
      }
    }
  }

  type Channel = {
    channel_id: string
    channel_type: 'evolution' | 'cloud' | 'legacy'
    label: string
    instance_name: string | null
    hub_connection_id: string | null
    conversations: typeof withPreview
  }

  const channelMap = new Map<string, Channel>()

  for (const c of withPreview) {
    let key: string
    let channel: Channel

    if (c.hub_connection_id && hubMeta.has(c.hub_connection_id)) {
      const hm = hubMeta.get(c.hub_connection_id)!
      key = c.hub_connection_id
      channel =
        channelMap.get(key) ??
        {
          channel_id: key,
          channel_type: hm.platform_id === 'whatsapp_evolution' ? 'evolution' : 'cloud',
          label: hm.label,
          instance_name: hm.instance_name,
          hub_connection_id: c.hub_connection_id,
          conversations: [],
        }
    } else {
      const st = (c.state as { evolution_instance?: string } | null) || {}
      const inst = String(st.evolution_instance || '').trim()
      if (inst) {
        key = `evo-legacy:${inst.toLowerCase()}`
        channel =
          channelMap.get(key) ??
          {
            channel_id: key,
            channel_type: 'evolution',
            label: inst,
            instance_name: inst,
            hub_connection_id: null,
            conversations: [],
          }
      } else {
        key = 'legacy'
        channel =
          channelMap.get(key) ??
          {
            channel_id: key,
            channel_type: 'legacy',
            label: 'Sem instância vinculada',
            instance_name: null,
            hub_connection_id: null,
            conversations: [],
          }
      }
    }

    channel.conversations.push(c)
    channelMap.set(key, channel)
  }

  if (auth.kind === 'staff') {
    const { data: evolutionHubs } = await auth.supabase
      .from('hub_connections')
      .select('id, metadata')
      .eq('platform_id', 'whatsapp_evolution')
      .eq('organization_id', auth.organizationId)

    for (const h of evolutionHubs || []) {
      const hid = String(h.id)
      if (channelMap.has(hid)) continue
      const meta = (h.metadata as { instance_name?: string; label?: string }) || {}
      const instanceName = String(meta.instance_name || '').trim()
      if (!instanceName) continue
      channelMap.set(hid, {
        channel_id: hid,
        channel_type: 'evolution',
        label: evolutionHubDisplayLabel(meta),
        instance_name: instanceName,
        hub_connection_id: hid,
        conversations: [],
      })
    }
  }

  const channels = [...channelMap.values()].sort((a, b) => {
    const ta = a.conversations[0]?.last_message_at ?? ''
    const tb = b.conversations[0]?.last_message_at ?? ''
    return tb.localeCompare(ta)
  })

  return NextResponse.json({
    ok: true,
    channels,
    conversations: withPreview,
  })
}
