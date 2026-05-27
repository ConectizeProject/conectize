import { isGroupWaKey } from '@/lib/whatsapp/wa-conversation-key'

export function toEvolutionRemoteJid (waFrom: string): string {
  const key = String(waFrom || '').trim()
  if (!key) return ''
  if (isGroupWaKey(key)) return key
  const digits = key.replace(/\D/g, '')
  if (!digits) return ''
  return `${digits}@s.whatsapp.net`
}

export function parseEvolutionStableMessageId (stableId: string): string {
  const raw = String(stableId || '').trim()
  const idx = raw.indexOf(':')
  return idx >= 0 ? raw.slice(idx + 1) : raw
}

export async function archiveEvolutionChat (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
  remoteJid: string
  lastMessageId: string
  lastMessageFromMe: boolean
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const trimmedBase = opts.baseUrl.replace(/\/$/, '')
  const encoded = encodeURIComponent(opts.instanceName)
  const url = `${trimmedBase}/chat/archiveChat/${encoded}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: opts.apiKey,
      },
      body: JSON.stringify({
        chat: opts.remoteJid,
        archive: true,
        lastMessage: {
          key: {
            remoteJid: opts.remoteJid,
            fromMe: opts.lastMessageFromMe,
            id: opts.lastMessageId,
          },
        },
      }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      const msg = String(data?.message || data?.error || res.statusText || 'archive_failed')
      return { ok: false, error: msg, status: res.status }
    }

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch_failed'
    return { ok: false, error: msg }
  }
}
