import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WHATSAPP_MEDIA_BUCKET,
  readWhatsappMessageMedia,
} from '@/lib/whatsapp/whatsapp-media-types'

const BATCH_SIZE = 80

export async function cleanupExpiredWhatsappMedia (
  supabase: SupabaseClient,
): Promise<{ scanned: number; deleted: number; errors: number }> {
  const nowIso = new Date().toISOString()
  const stats = { scanned: 0, deleted: 0, errors: 0 }

  const { data: rows, error } = await supabase
    .from('whatsapp_messages')
    .select('id, payload')
    .not('payload', 'is', null)
    .limit(BATCH_SIZE * 4)

  if (error) {
    console.error('[whatsapp-media-cleanup] query', error)
    return stats
  }

  const due = (rows || []).filter((row) => {
    const media = readWhatsappMessageMedia(
      (row.payload as Record<string, unknown> | null) || {},
    )
    if (!media?.storage_path) return false
    return Date.parse(media.media_expires_at) < Date.parse(nowIso)
  }).slice(0, BATCH_SIZE)

  for (const row of due) {
    stats.scanned += 1
    const payload = (row.payload as Record<string, unknown> | null) || {}
    const media = readWhatsappMessageMedia(payload)
    if (!media?.storage_path) continue

    const { error: rmErr } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .remove([media.storage_path])

    if (rmErr) {
      stats.errors += 1
      console.warn('[whatsapp-media-cleanup] remove', row.id, rmErr.message)
      continue
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
      .eq('id', row.id)

    if (upErr) {
      stats.errors += 1
      console.warn('[whatsapp-media-cleanup] update', row.id, upErr.message)
      continue
    }

    stats.deleted += 1
  }

  return stats
}
