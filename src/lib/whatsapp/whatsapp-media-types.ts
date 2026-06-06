import type { EvolutionMediaKind } from '@/lib/whatsapp/parse-evolution-webhook-media'

export const WHATSAPP_MEDIA_BUCKET = 'whatsapp-media'

export const WHATSAPP_MEDIA_TTL_MS =
  (Number(process.env.WHATSAPP_MEDIA_TTL_HOURS) > 0
    ? Number(process.env.WHATSAPP_MEDIA_TTL_HOURS)
    : 24) *
  60 *
  60 *
  1000

export type WhatsappMessageMediaPayload = {
  type: EvolutionMediaKind
  mime_type: string
  storage_path: string
  file_name: string | null
  size_bytes: number
  media_expires_at: string
  download_error?: string
  expired?: boolean
}

export function readWhatsappMessageMedia (
  payload: unknown,
): WhatsappMessageMediaPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const media = (payload as { media?: unknown }).media
  if (!media || typeof media !== 'object') return null
  const m = media as WhatsappMessageMediaPayload
  if (m.expired) return { ...m, storage_path: '' }
  if (m.download_error && !m.storage_path) return m
  if (!m.storage_path || !m.media_expires_at) return null
  return m
}

export function isWhatsappMediaExpired (media: WhatsappMessageMediaPayload): boolean {
  if (media.expired) return true
  const exp = Date.parse(media.media_expires_at)
  if (!Number.isFinite(exp)) return true
  return Date.now() >= exp
}
