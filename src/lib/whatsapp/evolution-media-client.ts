import type { EvolutionMediaDownloadRequest } from '@/lib/whatsapp/evolution-media-download-request'

export type EvolutionMediaBase64Result =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; error: string }

function pickBase64FromResponse (data: Record<string, unknown> | null): string {
  if (!data) return ''
  const direct = data.base64 ?? data.data
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const inner = data.response as Record<string, unknown> | undefined
  if (inner && typeof inner.base64 === 'string' && inner.base64.trim()) {
    return inner.base64.trim()
  }
  return ''
}

function pickMimeFromResponse (data: Record<string, unknown> | null): string {
  if (!data) return 'application/octet-stream'
  const mime = data.mimetype ?? data.mimeType ?? data.contentType
  if (typeof mime === 'string' && mime.trim()) return mime.trim()
  const inner = data.response as Record<string, unknown> | undefined
  if (inner && typeof inner.mimetype === 'string' && inner.mimetype.trim()) {
    return inner.mimetype.trim()
  }
  return 'application/octet-stream'
}

function normalizeApiError (data: Record<string, unknown> | null, status: number): string {
  const response = data?.response
  if (response && typeof response === 'object') {
    const msg = (response as { message?: unknown }).message
    if (Array.isArray(msg) && msg.length) return String(msg[0])
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim()
  return `http_${status}`
}

export function isRetryableEvolutionMediaError (error: string): boolean {
  const e = error.toLowerCase()
  return (
    e.includes('not found') ||
    e.includes('message not found') ||
    e === 'empty_base64' ||
    e.includes('bad request') ||
    e.includes('aggregateerror')
  )
}

function sleep (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Evolution API v2 — baixa mídia da mensagem em base64.
 * @see https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
 */
export async function fetchEvolutionMediaBase64 (opts: {
  baseUrl: string
  apiKey: string
  instanceName: string
  downloadRequest: EvolutionMediaDownloadRequest
}): Promise<EvolutionMediaBase64Result> {
  const { baseUrl, apiKey, instanceName, downloadRequest } = opts
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const encoded = encodeURIComponent(instanceName)
  const url = `${trimmedBase}/chat/getBase64FromMediaMessage/${encoded}`

  const delays = [0, 2500, 6000]
  let lastError = 'fetch_failed'

  for (const delayMs of delays) {
    if (delayMs > 0) await sleep(delayMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          message: downloadRequest.message,
          convertToMp4: downloadRequest.convertToMp4,
        }),
      })
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) {
        lastError = normalizeApiError(data, res.status)
        if (!isRetryableEvolutionMediaError(lastError)) {
          return { ok: false, error: lastError }
        }
        continue
      }
      const base64 = pickBase64FromResponse(data)
      if (!base64) {
        lastError = 'empty_base64'
        continue
      }
      return {
        ok: true,
        base64,
        mimeType: pickMimeFromResponse(data),
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'fetch_failed'
    }
  }

  return { ok: false, error: lastError }
}
