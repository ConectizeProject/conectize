import type { SupabaseClient } from '@supabase/supabase-js'
import { formatWaConversationLabel } from '@/lib/whatsapp/wa-conversation-key'
import {
  readWhatsappMessageMedia,
  WHATSAPP_MEDIA_BUCKET,
  type WhatsappMessageMediaPayload,
} from '@/lib/whatsapp/whatsapp-media-types'

const SIGNED_URL_EXPIRES_SECONDS = 60 * 60
const LIST_LIMIT = 1000
const SIGN_CONCURRENCY = 16

export type WhatsappMediaListItem = {
  messageId: string
  conversationId: string
  conversationLabel: string
  waFrom: string
  createdAt: string
  storagePath: string
  sizeBytes: number
  mimeType: string
  fileName: string | null
  url: string | null
}

type MessageDbRow = {
  id: string
  conversation_id: string
  created_at: string
  body: string | null
  payload: Record<string, unknown> | null
  whatsapp_conversations:
    | { wa_from: string; state: { display_name?: string | null; is_group?: boolean } | null }
    | Array<{ wa_from: string; state: { display_name?: string | null; is_group?: boolean } | null }>
    | null
}

function resolveConversation (
  value: MessageDbRow['whatsapp_conversations'],
): { wa_from: string; state: { display_name?: string | null; is_group?: boolean } | null } | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export function isWhatsappImageMedia (media: WhatsappMessageMediaPayload): boolean {
  if (media.type === 'image' || media.type === 'sticker') return true
  return media.mime_type.toLowerCase().startsWith('image/')
}

export function formatMediaSizeBytes (bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function mapPool<T, R> (
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker () {
    while (next < items.length) {
      const i = next
      next += 1
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

function rowToImageItem (row: MessageDbRow): WhatsappMediaListItem | null {
  const media = readWhatsappMessageMedia(row.payload || {})
  if (!media?.storage_path || media.expired) return null
  if (!isWhatsappImageMedia(media)) return null

  const conversation = resolveConversation(row.whatsapp_conversations)
  if (!conversation) return null

  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    conversationLabel: formatWaConversationLabel(conversation.wa_from, conversation.state),
    waFrom: conversation.wa_from,
    createdAt: row.created_at,
    storagePath: media.storage_path,
    sizeBytes: media.size_bytes ?? 0,
    mimeType: media.mime_type,
    fileName: media.file_name,
    url: null,
  }
}

export async function listStoredWhatsappImages (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<WhatsappMediaListItem[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select(`
      id,
      conversation_id,
      created_at,
      body,
      payload,
      whatsapp_conversations!inner (
        wa_from,
        state,
        organization_id
      )
    `)
    .eq('whatsapp_conversations.organization_id', organizationId)
    .filter('payload->media->>storage_path', 'neq', '')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (error) {
    throw new Error(error.message)
  }

  const items = ((data ?? []) as MessageDbRow[])
    .map(rowToImageItem)
    .filter((item): item is WhatsappMediaListItem => item !== null)
    .sort((a, b) => {
      if (b.sizeBytes !== a.sizeBytes) return b.sizeBytes - a.sizeBytes
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  if (items.length === 0) return items

  const signed = await mapPool(items, SIGN_CONCURRENCY, async (item) => {
    const { data: signedUrl } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(item.storagePath, SIGNED_URL_EXPIRES_SECONDS)
    return {
      ...item,
      url: signedUrl?.signedUrl ?? null,
    }
  })

  return signed
}

export async function deleteWhatsappImageMedia (
  supabase: SupabaseClient,
  organizationId: string,
  messageId: string,
): Promise<void> {
  const { data: row, error: findErr } = await supabase
    .from('whatsapp_messages')
    .select(`
      id,
      payload,
      whatsapp_conversations!inner (
        organization_id
      )
    `)
    .eq('id', messageId)
    .eq('whatsapp_conversations.organization_id', organizationId)
    .maybeSingle()

  if (findErr) {
    throw new Error(findErr.message)
  }
  if (!row) {
    throw new Error('not_found')
  }

  const payload = (row.payload as Record<string, unknown> | null) || {}
  const media = readWhatsappMessageMedia(payload)
  if (!media?.storage_path || media.expired) {
    throw new Error('not_found')
  }
  if (!isWhatsappImageMedia(media)) {
    throw new Error('not_image')
  }

  const { error: rmErr } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .remove([media.storage_path])

  if (rmErr) {
    console.warn('[whatsapp-media-admin delete] storage', rmErr.message)
  }

  const nextPayload = {
    ...payload,
    media: {
      ...media,
      storage_path: '',
      expired: true,
    },
  }

  const { error: upErr } = await supabase
    .from('whatsapp_messages')
    .update({ payload: nextPayload })
    .eq('id', messageId)

  if (upErr) {
    throw new Error(upErr.message)
  }
}
