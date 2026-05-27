import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchEvolutionMediaBase64 } from '@/lib/whatsapp/evolution-media-client'
import type { EvolutionMediaDownloadRequest } from '@/lib/whatsapp/evolution-media-download-request'
import {
  buildEvolutionMediaDownloadRequestFromStableId,
  readEvolutionMediaFetchFromPayload,
} from '@/lib/whatsapp/evolution-media-download-request'
import type { EvolutionMediaDescriptor } from '@/lib/whatsapp/parse-evolution-webhook-media'
import {
  readWhatsappMessageMedia,
  WHATSAPP_MEDIA_BUCKET,
  WHATSAPP_MEDIA_TTL_MS,
  type WhatsappMessageMediaPayload,
} from '@/lib/whatsapp/whatsapp-media-types'

function extensionFromMime (mime: string): string {
  const m = mime.toLowerCase().split(';')[0].trim()
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
  }
  return map[m] || 'bin'
}

function buildStoragePath (
  organizationId: string,
  conversationId: string,
  messageRowId: string,
  ext: string,
): string {
  return `${organizationId}/${conversationId}/${messageRowId}.${ext}`
}

function decodeBase64Payload (raw: string): Buffer | null {
  const cleaned = raw.replace(/^data:[^;]+;base64,/, '').trim()
  if (!cleaned) return null
  try {
    return Buffer.from(cleaned, 'base64')
  } catch {
    return null
  }
}

function mediaKindFromPayload (payload: Record<string, unknown>): EvolutionMediaDescriptor['kind'] {
  const media = payload.media as { type?: string } | undefined
  const t = String(media?.type || '').trim()
  if (t === 'image' || t === 'video' || t === 'audio' || t === 'document' || t === 'sticker') {
    return t
  }
  return 'document'
}

function buildMediaDescriptor (
  media: EvolutionMediaDescriptor | null,
  payload: Record<string, unknown>,
): EvolutionMediaDescriptor {
  if (media) return media
  const prev = payload.media as { file_name?: string } | undefined
  return {
    kind: mediaKindFromPayload(payload),
    label: '',
    convertToMp4: false,
    fileName: prev?.file_name ?? null,
  }
}

export async function persistWhatsappEvolutionMedia (opts: {
  supabase: SupabaseClient
  organizationId: string
  conversationId: string
  messageRowId: string
  baseUrl: string
  apiKey: string
  instanceName: string
  downloadRequest: EvolutionMediaDownloadRequest
  media: EvolutionMediaDescriptor | null
}): Promise<void> {
  const {
    supabase,
    organizationId,
    conversationId,
    messageRowId,
    baseUrl,
    apiKey,
    instanceName,
    downloadRequest,
    media: mediaIn,
  } = opts

  const { data: existing } = await supabase
    .from('whatsapp_messages')
    .select('id, payload')
    .eq('id', messageRowId)
    .maybeSingle()

  if (!existing?.id) return

  const prevPayload = (existing.payload as Record<string, unknown> | null) || {}
  const prevMedia = prevPayload.media as WhatsappMessageMediaPayload | undefined
  if (prevMedia?.storage_path && !prevMedia.expired && !prevMedia.download_error) return

  const media = buildMediaDescriptor(mediaIn, prevPayload)

  const fetched = await fetchEvolutionMediaBase64({
    baseUrl,
    apiKey,
    instanceName,
    downloadRequest,
  })

  const expiresAt = new Date(Date.now() + WHATSAPP_MEDIA_TTL_MS).toISOString()
  const payloadWithFetch = {
    ...prevPayload,
    evolution_media_fetch: downloadRequest,
  }

  if (fetched.ok === false) {
    await supabase
      .from('whatsapp_messages')
      .update({
        payload: {
          ...payloadWithFetch,
          media: {
            type: media.kind,
            mime_type: 'application/octet-stream',
            storage_path: '',
            file_name: media.fileName,
            size_bytes: 0,
            media_expires_at: expiresAt,
            download_error: fetched.error,
          },
        },
      })
      .eq('id', messageRowId)
    console.warn('[whatsapp-media] download failed', messageRowId, fetched.error)
    return
  }

  const buf = decodeBase64Payload(fetched.base64)
  if (!buf || buf.length === 0) {
    console.warn('[whatsapp-media] empty buffer', messageRowId)
    return
  }

  if (buf.length > 15 * 1024 * 1024) {
    console.warn('[whatsapp-media] file too large', messageRowId, buf.length)
    return
  }

  const ext = extensionFromMime(fetched.mimeType)
  const storagePath = buildStoragePath(
    organizationId,
    conversationId,
    messageRowId,
    ext,
  )

  const { error: upErr } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(storagePath, buf, {
      contentType: fetched.mimeType,
      upsert: true,
    })

  if (upErr) {
    console.warn('[whatsapp-media] upload failed', messageRowId, upErr.message)
    return
  }

  const mediaPayload: WhatsappMessageMediaPayload = {
    type: media.kind,
    mime_type: fetched.mimeType,
    storage_path: storagePath,
    file_name: media.fileName,
    size_bytes: buf.length,
    media_expires_at: expiresAt,
  }

  const { evolution_media_fetch: _fetch, ...cleanPayload } = payloadWithFetch

  await supabase
    .from('whatsapp_messages')
    .update({
      payload: { ...cleanPayload, media: mediaPayload },
    })
    .eq('id', messageRowId)
}

export async function attachEvolutionMediaToStoredMessage (opts: {
  supabase: SupabaseClient
  organizationId: string
  stableWaMessageId: string
  baseUrl: string
  apiKey: string
  instanceName: string
  downloadRequest: EvolutionMediaDownloadRequest
  media: EvolutionMediaDescriptor
}): Promise<void> {
  const { supabase, stableWaMessageId, ...rest } = opts

  const { data: row } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_id')
    .eq('wa_message_id', stableWaMessageId)
    .maybeSingle()

  if (!row?.id || !row.conversation_id) return

  await persistWhatsappEvolutionMedia({
    supabase,
    organizationId: rest.organizationId,
    conversationId: row.conversation_id,
    messageRowId: row.id,
    baseUrl: rest.baseUrl,
    apiKey: rest.apiKey,
    instanceName: rest.instanceName,
    downloadRequest: rest.downloadRequest,
    media: rest.media,
  })
}

const RETRY_DOWNLOAD_LIMIT = 3

/** Re-tenta download para mensagens com download_error ao abrir a conversa. */
export async function retryFailedWhatsappMediaDownloads (opts: {
  supabase: SupabaseClient
  organizationId: string
  conversationId: string
  conversationKey: string
  baseUrl: string
  apiKey: string
  instanceName: string
  messages: Array<{
    id: string
    wa_message_id?: string
    payload?: Record<string, unknown>
  }>
}): Promise<void> {
  const {
    supabase,
    organizationId,
    conversationId,
    conversationKey,
    baseUrl,
    apiKey,
    instanceName,
    messages,
  } = opts

  let retried = 0
  for (const m of messages) {
    if (retried >= RETRY_DOWNLOAD_LIMIT) break
    const payload = (m.payload as Record<string, unknown> | undefined) || {}
    const media = readWhatsappMessageMedia(payload)
    if (!media?.download_error) continue
    let downloadRequest = readEvolutionMediaFetchFromPayload(payload)
    if (!downloadRequest && m.wa_message_id) {
      downloadRequest = buildEvolutionMediaDownloadRequestFromStableId(
        m.wa_message_id,
        conversationKey,
        media.type === 'video',
      )
    }
    if (!downloadRequest) continue

    retried += 1
    await persistWhatsappEvolutionMedia({
      supabase,
      organizationId,
      conversationId,
      messageRowId: m.id,
      baseUrl,
      apiKey,
      instanceName,
      downloadRequest,
      media: null,
    })
  }
}
