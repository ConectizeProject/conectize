import crypto from 'crypto'

function hmacHex (secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function hmacBase64 (secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

function timingEqual (a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

/**
 * Bling: header `X-Bling-Signature-256` = `sha256=` + HMAC-SHA256(body, client_secret) em hex.
 */
export function verifyBlingWebhookSignature (
  rawBody: string,
  signatureHeader: string | null,
  clientSecret: string,
): boolean {
  if (!signatureHeader || !clientSecret) return false
  const received = signatureHeader.replace(/^sha256=/i, '').trim()
  if (!received) return false

  const hex = hmacHex(clientSecret, rawBody)
  const b64 = hmacBase64(clientSecret, rawBody)
  if (timingEqual(received.toLowerCase(), hex.toLowerCase())) return true
  if (timingEqual(received, b64)) return true
  if (timingEqual(signatureHeader.trim(), `sha256=${hex}`)) return true
  return false
}
