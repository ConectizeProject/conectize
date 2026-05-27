/** Detecção de mídia em payloads MESSAGES_UPSERT da Evolution. */

import { sanitizeEvolutionMessageKey } from '@/lib/whatsapp/evolution-media-download-request'

export type EvolutionMediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'

export type EvolutionMediaDescriptor = {
  kind: EvolutionMediaKind
  label: string
  convertToMp4: boolean
  fileName: string | null
}

const MEDIA_LABELS: Record<EvolutionMediaKind, string> = {
  image: '[Imagem]',
  video: '[Vídeo]',
  audio: '[Áudio]',
  document: '[Documento]',
  sticker: '[Figurinha]',
}

function readFileName (block: Record<string, unknown> | undefined): string | null {
  if (!block) return null
  const name = String(block.fileName || block.title || '').trim()
  return name || null
}

function pickMediaFromContent (m: Record<string, unknown>): EvolutionMediaDescriptor | null {
  if (m.imageMessage && typeof m.imageMessage === 'object') {
    return {
      kind: 'image',
      label: MEDIA_LABELS.image,
      convertToMp4: false,
      fileName: readFileName(m.imageMessage as Record<string, unknown>),
    }
  }
  if (m.videoMessage && typeof m.videoMessage === 'object') {
    return {
      kind: 'video',
      label: MEDIA_LABELS.video,
      convertToMp4: true,
      fileName: readFileName(m.videoMessage as Record<string, unknown>),
    }
  }
  if (m.audioMessage && typeof m.audioMessage === 'object') {
    return {
      kind: 'audio',
      label: MEDIA_LABELS.audio,
      convertToMp4: false,
      fileName: readFileName(m.audioMessage as Record<string, unknown>),
    }
  }
  if (m.documentMessage && typeof m.documentMessage === 'object') {
    return {
      kind: 'document',
      label: MEDIA_LABELS.document,
      convertToMp4: false,
      fileName: readFileName(m.documentMessage as Record<string, unknown>),
    }
  }
  if (m.stickerMessage && typeof m.stickerMessage === 'object') {
    return {
      kind: 'sticker',
      label: MEDIA_LABELS.sticker,
      convertToMp4: false,
      fileName: null,
    }
  }
  const dwc = m.documentWithCaptionMessage as Record<string, unknown> | undefined
  if (dwc?.message && typeof dwc.message === 'object') {
    return pickMediaFromContent(dwc.message as Record<string, unknown>)
  }
  return null
}

export function detectEvolutionMedia (
  item: Record<string, unknown>,
): EvolutionMediaDescriptor | null {
  let m = item.message as Record<string, unknown> | undefined
  if (!m || typeof m !== 'object') {
    const mt = String(item.messageType || '').trim().toLowerCase()
    if (mt.includes('image')) {
      return { kind: 'image', label: MEDIA_LABELS.image, convertToMp4: false, fileName: null }
    }
    if (mt.includes('video')) {
      return { kind: 'video', label: MEDIA_LABELS.video, convertToMp4: true, fileName: null }
    }
    if (mt.includes('audio')) {
      return { kind: 'audio', label: MEDIA_LABELS.audio, convertToMp4: false, fileName: null }
    }
    if (mt.includes('document')) {
      return { kind: 'document', label: MEDIA_LABELS.document, convertToMp4: false, fileName: null }
    }
    if (mt.includes('sticker')) {
      return { kind: 'sticker', label: MEDIA_LABELS.sticker, convertToMp4: false, fileName: null }
    }
    return null
  }

  for (let depth = 0; depth < 5; depth++) {
    const found = pickMediaFromContent(m)
    if (found) return found
    const wrapped =
      (m.ephemeralMessage as Record<string, unknown> | undefined)?.message ??
      (m.viewOnceMessage as Record<string, unknown> | undefined)?.message ??
      (m.viewOnceMessageV2 as Record<string, unknown> | undefined)?.message
    if (!wrapped || typeof wrapped !== 'object') break
    m = wrapped as Record<string, unknown>
  }

  return null
}

export function buildEvolutionMediaDownloadKey (
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  return sanitizeEvolutionMessageKey(item.key as Record<string, unknown> | undefined)
}
