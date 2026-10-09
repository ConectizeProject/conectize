import type { SupabaseClient } from '@supabase/supabase-js'

const DAY_MS = 24 * 60 * 60 * 1000
const PREVIEW_CONVERSATIONS = 8
const PREVIEW_MESSAGES_CAP = 200

export const WHATSAPP_MESSAGE_PURGE_SCOPES = [
  { id: '30d', label: 'Mensagens com mais de 30 dias', days: 30 },
  { id: '90d', label: 'Mensagens com mais de 90 dias', days: 90 },
  { id: '180d', label: 'Mensagens com mais de 6 meses', days: 180 },
  { id: '365d', label: 'Mensagens com mais de 1 ano', days: 365 },
  { id: 'all', label: 'Todas as mensagens', days: null },
] as const

export type WhatsappMessagePurgeScope = (typeof WHATSAPP_MESSAGE_PURGE_SCOPES)[number]['id']

export type WhatsappMessagesDbPreview = {
  scope: WhatsappMessagePurgeScope
  cutoffAt: string | null
  messageCount: number
  countComplete: boolean
  conversationCount: number
  tableBytes: number | null
}

export type WhatsappMessagesDbPurgeResult = {
  deletedMessages: number
  deletedConversations: number
  storageRemoveErrors: number
  hasMore: boolean
  nextCursor: string | null
}

type MessagePurgeRow = {
  id: string
  payload: unknown
}

type DbError = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export function isWhatsappMessagePurgeScope (value: string): value is WhatsappMessagePurgeScope {
  return WHATSAPP_MESSAGE_PURGE_SCOPES.some((scope) => scope.id === value)
}

export function whatsappMessagePurgeCutoffIso (
  scope: WhatsappMessagePurgeScope,
  now = new Date(),
): string | null {
  const days = WHATSAPP_MESSAGE_PURGE_SCOPES.find((item) => item.id === scope)?.days
  if (days == null) return null
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}

/** Limite superior da exclusão "todas": não aceita data no futuro. */
export function resolveWhatsappPurgeStartedAt (startedAt: string | null | undefined, now = new Date()): string {
  const parsed = startedAt ? new Date(startedAt) : now
  if (Number.isNaN(parsed.getTime())) return now.toISOString()
  if (parsed.getTime() > now.getTime() + 60_000) return now.toISOString()
  return parsed.toISOString()
}

export function readWhatsappStoragePath (payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const media = (payload as { media?: unknown }).media
  if (!media || typeof media !== 'object') return null
  const path = String((media as { storage_path?: unknown }).storage_path || '').trim()
  return path || null
}

function throwDb (error: DbError): never {
  const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' ')
  throw new Error(message || 'db_error')
}

function isMissingBytesRpc (message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('admin_whatsapp_messages_table_bytes')
    && (
      normalized.includes('could not find')
      || normalized.includes('schema cache')
      || normalized.includes('does not exist')
    )
}

async function nextConversationId (
  supabase: SupabaseClient,
  organizationId: string,
  afterId: string | null,
): Promise<string | null> {
  let query = supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .order('id', { ascending: true })
    .limit(1)

  if (afterId) query = query.gt('id', afterId)

  const { data, error } = await query
  if (error) throwDb(error)
  const id = data?.[0]?.id
  return id ? String(id) : null
}

async function listMessagesForConversation (
  supabase: SupabaseClient,
  conversationId: string,
  cutoffAt: string | null,
  limit: number,
): Promise<MessagePurgeRow[]> {
  let query = supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (cutoffAt) query = query.lte('created_at', cutoffAt)

  const { data, error } = await query
  if (error) throwDb(error)
  return (data || []).map((row) => ({ id: String(row.id), payload: null }))
}

async function loadTableBytes (supabase: SupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc('admin_whatsapp_messages_table_bytes')
  if (error) {
    if (!isMissingBytesRpc(error.message)) {
      console.warn('[whatsapp-messages-db-cleanup] table bytes', error.message)
    }
    return null
  }
  if (typeof data === 'number' && Number.isFinite(data)) return data
  if (typeof data === 'string') {
    const parsed = Number(data)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export async function previewWhatsappMessagesDbCleanup (
  supabase: SupabaseClient,
  organizationId: string,
  scope: WhatsappMessagePurgeScope,
  now = new Date(),
): Promise<WhatsappMessagesDbPreview> {
  const cutoffAt = whatsappMessagePurgeCutoffIso(scope, now)
  const tableBytes = await loadTableBytes(supabase)

  let messageCount = 0
  let countComplete = false
  let afterId: string | null = null

  const maxConversations = 20

  for (let index = 0; index < maxConversations; index += 1) {
    const conversationId = await nextConversationId(supabase, organizationId, afterId)
    if (!conversationId) {
      countComplete = true
      break
    }

    const rows = await listMessagesForConversation(
      supabase,
      conversationId,
      cutoffAt,
      PREVIEW_MESSAGES_CAP,
    )
    messageCount += rows.length
    afterId = conversationId

    if (rows.length >= PREVIEW_MESSAGES_CAP) break
    if (messageCount > 0 && index >= PREVIEW_CONVERSATIONS - 1) break
  }

  if (!countComplete && afterId) {
    const followingId = await nextConversationId(supabase, organizationId, afterId)
    if (!followingId && messageCount < PREVIEW_MESSAGES_CAP) countComplete = true
  }

  return {
    scope,
    cutoffAt,
    messageCount,
    countComplete,
    conversationCount: 0,
    tableBytes,
  }
}

function toNumber (value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function isMissingPurgeRpc (message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('admin_purge_whatsapp_messages')
    && (
      normalized.includes('could not find')
      || normalized.includes('schema cache')
      || normalized.includes('does not exist')
    )
}

async function deleteMessagesWhere (
  supabase: SupabaseClient,
  cutoffAt: string | null,
): Promise<number> {
  let query = supabase
    .from('whatsapp_messages')
    .delete({ count: 'exact' })

  if (cutoffAt) query = query.lte('created_at', cutoffAt)

  const { error, count } = await query
  if (error) throwDb(error)
  return count ?? 0
}

async function deleteConversationsWhere (
  supabase: SupabaseClient,
  organizationId: string,
  cutoffAt: string | null,
): Promise<number> {
  let query = supabase
    .from('whatsapp_conversations')
    .delete({ count: 'exact' })
    .eq('organization_id', organizationId)

  if (cutoffAt) query = query.lte('last_message_at', cutoffAt)

  const { error, count } = await query
  if (error) throwDb(error)
  return count ?? 0
}

export async function purgeWhatsappMessagesFromDatabase (
  supabase: SupabaseClient,
  organizationId: string,
  cutoffAt: string | null,
): Promise<WhatsappMessagesDbPurgeResult> {
  const { data, error } = await supabase.rpc('admin_purge_whatsapp_messages', {
    p_organization_id: organizationId,
    p_before: cutoffAt,
  })

  if (!error) {
    const row = (data || {}) as { messages?: unknown; conversations?: unknown }
    return {
      deletedMessages: toNumber(row.messages),
      deletedConversations: toNumber(row.conversations),
      storageRemoveErrors: 0,
      hasMore: false,
      nextCursor: null,
    }
  }

  if (!isMissingPurgeRpc(error.message)) throwDb(error)

  if (cutoffAt == null) {
    const deletedConversations = await deleteConversationsWhere(supabase, organizationId, null)
    return {
      deletedMessages: 0,
      deletedConversations,
      storageRemoveErrors: 0,
      hasMore: false,
      nextCursor: null,
    }
  }

  const deletedMessages = await deleteMessagesWhere(supabase, cutoffAt)
  const deletedConversations = await deleteConversationsWhere(supabase, organizationId, cutoffAt)
  return {
    deletedMessages,
    deletedConversations,
    storageRemoveErrors: 0,
    hasMore: false,
    nextCursor: null,
  }
}
