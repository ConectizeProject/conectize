import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WHATSAPP_MEDIA_BUCKET,
  readWhatsappMessageMedia,
} from '@/lib/whatsapp/whatsapp-media-types'

/** Remove mensagem do portal (e mídia no Storage, se houver). Não apaga no WhatsApp. */
export async function deleteWhatsappMessageFromPortal (
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'db_error' }> {
  const { data: row, error: findErr } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_id, payload')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (findErr) return { ok: false, error: 'db_error' }
  if (!row) return { ok: false, error: 'not_found' }

  const media = readWhatsappMessageMedia(
    (row.payload as Record<string, unknown> | null) || {},
  )
  if (media?.storage_path) {
    await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).remove([media.storage_path])
  }

  const { error: delErr } = await supabase
    .from('whatsapp_messages')
    .delete()
    .eq('id', messageId)

  if (delErr) return { ok: false, error: 'db_error' }
  return { ok: true }
}

const BULK_DELETE_MAX = 200

/** Remove várias mensagens do portal (mesma conversa). Não apaga no WhatsApp. */
export async function deleteWhatsappMessagesFromPortalBulk (
  supabase: SupabaseClient,
  conversationId: string,
  messageIds: string[],
): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: 'invalid_ids' | 'db_error' }
> {
  const unique = [...new Set(messageIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (unique.length === 0) return { ok: false, error: 'invalid_ids' }
  if (unique.length > BULK_DELETE_MAX) return { ok: false, error: 'invalid_ids' }

  const { data: rows, error: findErr } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_id, payload')
    .eq('conversation_id', conversationId)
    .in('id', unique)

  if (findErr) return { ok: false, error: 'db_error' }
  if (!rows?.length) return { ok: true, deleted: 0 }

  const storagePaths: string[] = []
  for (const row of rows) {
    const media = readWhatsappMessageMedia(
      (row.payload as Record<string, unknown> | null) || {},
    )
    if (media?.storage_path) storagePaths.push(media.storage_path)
  }
  if (storagePaths.length) {
    await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).remove(storagePaths)
  }

  const ids = rows.map((r) => r.id as string)
  const { error: delErr } = await supabase
    .from('whatsapp_messages')
    .delete()
    .in('id', ids)

  if (delErr) return { ok: false, error: 'db_error' }
  return { ok: true, deleted: ids.length }
}
