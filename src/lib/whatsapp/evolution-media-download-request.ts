import type { EvolutionMediaDescriptor } from '@/lib/whatsapp/parse-evolution-webhook-media'

export type EvolutionMediaDownloadRequest = {
  message: Record<string, unknown>
  convertToMp4: boolean
}

/** Chave mínima que a Evolution usa em getMessage / downloadMediaMessage. */
export function sanitizeEvolutionMessageKey (
  key: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!key || typeof key !== 'object') return null
  const id = String(key.id || '').trim()
  const remoteJid = String(key.remoteJid || key.remoteJidAlt || '').trim()
  if (!id || !remoteJid) return null
  const out: Record<string, unknown> = {
    id,
    remoteJid,
    fromMe: key.fromMe === true || key.fromMe === 'true',
  }
  const participant = String(key.participant || '').trim()
  if (participant) out.participant = participant
  return out
}

export function buildEvolutionMediaDownloadRequest (
  item: Record<string, unknown>,
  media: EvolutionMediaDescriptor,
): EvolutionMediaDownloadRequest | null {
  const key = sanitizeEvolutionMessageKey(item.key as Record<string, unknown> | undefined)
  if (!key) return null

  const inner = item.message
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return {
      message: { key, message: inner as Record<string, unknown> },
      convertToMp4: media.convertToMp4,
    }
  }

  return {
    message: { key },
    convertToMp4: media.convertToMp4,
  }
}

/** Reconstrói request mínimo a partir de wa_message_id (ex.: Victor:ABC) + JID da conversa. */
export function buildEvolutionMediaDownloadRequestFromStableId (
  stableWaMessageId: string,
  conversationKey: string,
  convertToMp4 = false,
): EvolutionMediaDownloadRequest | null {
  const stable = stableWaMessageId.trim()
  const jid = conversationKey.trim()
  const colon = stable.indexOf(':')
  if (colon < 0 || !jid) return null
  const id = stable.slice(colon + 1).trim()
  if (!id) return null
  return {
    message: {
      key: { id, remoteJid: jid, fromMe: false },
    },
    convertToMp4,
  }
}

export function readEvolutionMediaFetchFromPayload (
  payload: Record<string, unknown> | null | undefined,
): EvolutionMediaDownloadRequest | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = payload.evolution_media_fetch
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const message = rec.message
  if (!message || typeof message !== 'object') return null
  return {
    message: message as Record<string, unknown>,
    convertToMp4: rec.convertToMp4 === true,
  }
}
