import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isWhatsappMediaExpired,
  readWhatsappMessageMedia,
  WHATSAPP_MEDIA_BUCKET,
} from '@/lib/whatsapp/whatsapp-media-types'

const SIGNED_URL_TTL_SEC = 60 * 60
const SIGN_CONCURRENCY = 24

export type MessageWithMediaUrl = {
  id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  deleted_at: string | null
  payload?: Record<string, unknown>
  media_url: string | null
  media_expired: boolean
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

export async function enrichWhatsappMessagesWithMediaUrls (
  supabase: SupabaseClient,
  messages: Array<Record<string, unknown>>,
  opts?: { includeMediaUrls?: boolean },
): Promise<MessageWithMediaUrl[]> {
  const includeMediaUrls = opts?.includeMediaUrls !== false

  const base: MessageWithMediaUrl[] = messages.map((m) => {
    const payload = (m.payload as Record<string, unknown> | undefined) || {}
    const media = readWhatsappMessageMedia(payload)
    return {
      id: String(m.id),
      direction: String(m.direction),
      body: m.body != null ? String(m.body) : null,
      status: String(m.status),
      resolved_by: m.resolved_by != null ? String(m.resolved_by) : null,
      needs_human: Boolean(m.needs_human),
      created_at: String(m.created_at),
      deleted_at: m.deleted_at != null ? String(m.deleted_at) : null,
      payload,
      media_url: null,
      media_expired: Boolean(media?.expired),
    }
  })

  if (!includeMediaUrls) return base

  type SignJob = { index: number; path: string }
  const jobs: SignJob[] = []

  for (let i = 0; i < messages.length; i++) {
    const payload = (messages[i].payload as Record<string, unknown> | undefined) || {}
    const media = readWhatsappMessageMedia(payload)
    if (!media || isWhatsappMediaExpired(media) || !media.storage_path) {
      if (media) base[i].media_expired = true
      continue
    }
    jobs.push({ index: i, path: media.storage_path })
  }

  if (jobs.length === 0) return base

  const signed = await mapPool(jobs, SIGN_CONCURRENCY, async (job) => {
    const { data } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(job.path, SIGNED_URL_TTL_SEC)
    return { index: job.index, url: data?.signedUrl ?? null }
  })

  for (const { index, url } of signed) {
    base[index].media_url = url
    if (!url) base[index].media_expired = true
  }

  return base
}
