import crypto from 'crypto'

/**
 * Valida X-Hub-Signature-256 do webhook WhatsApp Cloud API (Meta).
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyMetaWhatsAppSignature(
	rawBody: string,
	signatureHeader: string | null,
	appSecret: string | null,
): boolean {
	if (!appSecret || !signatureHeader) return false
	const expected = crypto
		.createHmac('sha256', appSecret)
		.update(rawBody, 'utf8')
		.digest('hex')
	const received = signatureHeader.replace(/^sha256=/i, '').trim()
	if (!received || received.length !== expected.length) return false
	try {
		return crypto.timingSafeEqual(
			Buffer.from(received, 'hex'),
			Buffer.from(expected, 'hex'),
		)
	} catch {
		return false
	}
}
