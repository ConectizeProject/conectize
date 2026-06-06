/** Helpers para merge de eventos Supabase Realtime na inbox do portal. */

export type InboxMsg = {
  id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  deleted_at: string | null
  payload?: { source?: string; channel?: string }
}

export type InboxConv = {
  id: string
  wa_from: string
  hub_connection_id: string | null
  last_message_at: string
  needs_staff_attention: boolean
  draft_os: Record<string, string> | null
  state?: { display_name?: string; is_group?: boolean; evolution_instance?: string } | null
  service_order_id: string | null
  last_preview: string | null
  service_orders?: { display_number: number | null } | null
}

export type InboxChannel = {
  channel_id: string
  channel_type: 'evolution' | 'cloud' | 'legacy'
  label: string
  instance_name: string | null
  hub_connection_id: string | null
  conversations: InboxConv[]
}

export type RealtimeMessageRow = {
  id: string
  conversation_id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  deleted_at: string | null
  payload?: Record<string, unknown> | null
}

export type RealtimeConversationRow = {
  id: string
  wa_from?: string
  hub_connection_id?: string | null
  last_message_at?: string
  needs_staff_attention?: boolean
  draft_os?: Record<string, string> | null
  state?: InboxConv['state']
  service_order_id?: string | null
}

export function mapRealtimeRowToInboxMsg (row: RealtimeMessageRow): InboxMsg {
  const payload = row.payload as InboxMsg['payload'] | null | undefined
  return {
    id: row.id,
    direction: row.direction,
    body: row.body,
    status: row.status,
    resolved_by: row.resolved_by,
    needs_human: row.needs_human,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    payload: payload ?? undefined,
  }
}

function sortConversations (convs: InboxConv[]): InboxConv[] {
  return [...convs].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
}

function patchConvFromMessage (
  conv: InboxConv,
  msg: InboxMsg,
): InboxConv {
  const preview = String(msg.body || '').slice(0, 280)
  return {
    ...conv,
    last_message_at: msg.created_at,
    last_preview: preview || conv.last_preview,
    needs_staff_attention:
      msg.direction === 'in' ? true : conv.needs_staff_attention,
  }
}

export function applyMessageInsertToChannels (
  channels: InboxChannel[],
  row: RealtimeMessageRow,
): { channels: InboxChannel[]; foundConversation: boolean } {
  const msg = mapRealtimeRowToInboxMsg(row)
  const convId = row.conversation_id
  let foundConversation = false

  const next = channels.map((ch) => {
    const idx = ch.conversations.findIndex((c) => c.id === convId)
    if (idx < 0) return ch
    foundConversation = true
    const convs = [...ch.conversations]
    convs[idx] = patchConvFromMessage(convs[idx], msg)
    return { ...ch, conversations: sortConversations(convs) }
  })

  return { channels: next, foundConversation }
}

export function applyMessageUpdateToMessages (
  messages: InboxMsg[],
  row: RealtimeMessageRow,
): InboxMsg[] {
  const idx = messages.findIndex((m) => m.id === row.id)
  if (idx < 0) return messages
  const mapped = mapRealtimeRowToInboxMsg(row)
  const next = [...messages]
  next[idx] = mapped
  return next
}

export function isOptimisticInboxMessageId (id: string): boolean {
  return id.startsWith('optimistic-')
}

export function stripOptimisticInboxMessages (messages: InboxMsg[]): InboxMsg[] {
  return messages.filter((m) => !isOptimisticInboxMessageId(m.id))
}

export function applyMessageInsertToMessages (
  messages: InboxMsg[],
  row: RealtimeMessageRow,
  selectedConversationId: string | null,
): InboxMsg[] {
  if (!selectedConversationId || row.conversation_id !== selectedConversationId) {
    return messages
  }
  const base = stripOptimisticInboxMessages(messages)
  if (base.some((m) => m.id === row.id)) return base
  const next = [...base, mapRealtimeRowToInboxMsg(row)]
  next.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return next
}

export function sortInboxConversations (conversations: InboxConv[]): InboxConv[] {
  return sortConversations(conversations)
}

/** Atualiza preview e data da conversa após envio local (sem refetch da lista). */
export function patchConversationAfterOutboundMessage (
  conversations: InboxConv[],
  conversationId: string,
  body: string,
  createdAt: string,
): InboxConv[] {
  const idx = conversations.findIndex((c) => c.id === conversationId)
  if (idx < 0) return conversations
  const msg: InboxMsg = {
    id: 'optimistic-patch',
    direction: 'out',
    body,
    status: 'attended',
    resolved_by: 'human',
    needs_human: false,
    created_at: createdAt,
    deleted_at: null,
    payload: { source: 'staff' },
  }
  const next = [...conversations]
  next[idx] = patchConvFromMessage(next[idx], msg)
  next[idx] = { ...next[idx], needs_staff_attention: false }
  return sortConversations(next)
}

export function applyConversationUpdateToChannels (
  channels: InboxChannel[],
  row: RealtimeConversationRow,
): InboxChannel[] {
  const convId = row.id
  return channels.map((ch) => {
    const idx = ch.conversations.findIndex((c) => c.id === convId)
    if (idx < 0) return ch
    const prev = ch.conversations[idx]
    const convs = [...ch.conversations]
    convs[idx] = patchConvFromRealtimeRow(prev, row)
    return { ...ch, conversations: sortConversations(convs) }
  })
}

function patchConvFromRealtimeRow (
  prev: InboxConv,
  row: RealtimeConversationRow,
): InboxConv {
  return {
    ...prev,
    ...(row.wa_from !== undefined ? { wa_from: row.wa_from } : {}),
    ...(row.hub_connection_id !== undefined
      ? { hub_connection_id: row.hub_connection_id }
      : {}),
    ...(row.last_message_at !== undefined
      ? { last_message_at: row.last_message_at }
      : {}),
    ...(row.needs_staff_attention !== undefined
      ? { needs_staff_attention: row.needs_staff_attention }
      : {}),
    ...(row.draft_os !== undefined ? { draft_os: row.draft_os } : {}),
    ...(row.state !== undefined ? { state: row.state } : {}),
    ...(row.service_order_id !== undefined
      ? { service_order_id: row.service_order_id }
      : {}),
  }
}

export function applyMessageInsertToConversationList (
  conversations: InboxConv[],
  row: RealtimeMessageRow,
): { conversations: InboxConv[]; found: boolean } {
  const msg = mapRealtimeRowToInboxMsg(row)
  const convId = row.conversation_id
  const idx = conversations.findIndex((c) => c.id === convId)
  if (idx < 0) return { conversations, found: false }
  const next = [...conversations]
  next[idx] = patchConvFromMessage(next[idx], msg)
  return { conversations: sortConversations(next), found: true }
}

export function applyConversationUpdateToList (
  conversations: InboxConv[],
  row: RealtimeConversationRow,
): InboxConv[] {
  const idx = conversations.findIndex((c) => c.id === row.id)
  if (idx < 0) return conversations
  const next = [...conversations]
  next[idx] = patchConvFromRealtimeRow(next[idx], row)
  return sortConversations(next)
}

export function parseRealtimePayload<T> (record: unknown): T | null {
  if (!record || typeof record !== 'object') return null
  return record as T
}
