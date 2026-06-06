import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WHATSAPP_MEDIA_BUCKET,
  readWhatsappMessageMedia,
} from '@/lib/whatsapp/whatsapp-media-types'

const BULK_DELETE_MAX = 50

/** Remove conversas do portal (mensagens em cascade). Não apaga no WhatsApp. */
export async function deleteWhatsappConversationsFromPortalBulk (
  supabase: SupabaseClient,
  organizationId: string,
  conversationIds: string[],
): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: 'invalid_ids' | 'db_error' }
> {
  const unique = [...new Set(conversationIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (unique.length === 0) return { ok: false, error: 'invalid_ids' }
  if (unique.length > BULK_DELETE_MAX) return { ok: false, error: 'invalid_ids' }

  const { data: convs, error: findErr } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .in('id', unique)

  if (findErr) return { ok: false, error: 'db_error' }
  if (!convs?.length) return { ok: true, deleted: 0 }

  const ids = convs.map((c) => c.id as string)

  const { data: messages, error: msgErr } = await supabase
    .from('whatsapp_messages')
    .select('payload')
    .in('conversation_id', ids)

  if (msgErr) return { ok: false, error: 'db_error' }

  const storagePaths: string[] = []
  for (const row of messages || []) {
    const media = readWhatsappMessageMedia(
      (row.payload as Record<string, unknown> | null) || {},
    )
    if (media?.storage_path) storagePaths.push(media.storage_path)
  }
  if (storagePaths.length) {
    await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).remove(storagePaths)
  }

  const { error: delErr } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .in('id', ids)

  if (delErr) return { ok: false, error: 'db_error' }
  return { ok: true, deleted: ids.length }
}
