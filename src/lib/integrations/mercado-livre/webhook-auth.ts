import crypto from 'crypto'

export const MELI_WEBHOOK_SECRET_HEADER = 'x-meli-webhook-secret'
export const MELI_WEBHOOK_SECRET_QUERY = 'token'

function getMeliWebhookSecret (): string | null {
  const secret = process.env.MELI_WEBHOOK_SECRET?.trim()
  return secret || null
}

function timingEqual (a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

export function readMeliWebhookProvidedSecret (request: Request): string | null {
  const header =
    request.headers.get(MELI_WEBHOOK_SECRET_HEADER)
    ?? request.headers.get('X-Meli-Webhook-Secret')
    ?? request.headers.get('x-webhook-secret')
  if (header && header.trim()) return header.trim()

  try {
    const url = new URL(request.url)
    const fromQuery =
      url.searchParams.get(MELI_WEBHOOK_SECRET_QUERY)
      ?? url.searchParams.get('secret')
    if (fromQuery && fromQuery.trim()) return fromQuery.trim()
  } catch {
    return null
  }

  return null
}

export type MeliWebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: 'secret_not_configured' | 'missing_secret' | 'invalid_secret' }

/**
 * Mercado Livre não assina o body. A URL cadastrada no app deve incluir
 * `?token=<MELI_WEBHOOK_SECRET>` (ou o header x-meli-webhook-secret).
 * Sem segredo configurado o POST falha fechado (exceto ping vazio).
 */
export function verifyMeliWebhookAuth (request: Request): MeliWebhookAuthResult {
  const expected = getMeliWebhookSecret()
  if (!expected) {
    return { ok: false, reason: 'secret_not_configured' }
  }

  const provided = readMeliWebhookProvidedSecret(request)
  if (!provided) {
    return { ok: false, reason: 'missing_secret' }
  }
  if (!timingEqual(provided, expected)) {
    return { ok: false, reason: 'invalid_secret' }
  }
  return { ok: true }
}
