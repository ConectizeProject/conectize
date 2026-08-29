import { MELI_ORDERS_TOPIC } from '@/lib/integrations/mercado-livre/constants'

export type MeliWebhookParsed = {
	topic: string
	resource: string
	userId: string | null
	applicationId: string | null
	orderId: string | null
	raw: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	return value as Record<string, unknown>
}

export function normalizeMeliUserId(value: unknown): string | null {
	if (value == null) return null
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(Math.trunc(value))
	}
	const s = String(value).trim()
	if (!s) return null
	if (/^\d+\.0+$/.test(s)) return String(Math.trunc(Number(s)))
	return s
}

export function extractMeliOrderIdFromResource(
	resource: string | null | undefined,
): string | null {
	const raw = String(resource || '').trim()
	if (!raw) return null
	const match = raw.match(/\/orders\/(\d+)/i) || raw.match(/^orders\/(\d+)/i)
	return match?.[1] ?? null
}

export function parseMeliWebhook(payload: unknown): MeliWebhookParsed {
	const root = asRecord(payload) ?? {}
	const topic = String(root.topic ?? root.topic_id ?? '').trim()
	const resource = String(root.resource ?? '').trim()
	const userId = normalizeMeliUserId(root.user_id ?? root.userId)
	const applicationId =
		root.application_id != null ? String(root.application_id) : null

	return {
		topic: topic || 'unknown',
		resource,
		userId,
		applicationId,
		orderId: extractMeliOrderIdFromResource(resource),
		raw: root,
	}
}

export function isMeliOrdersTopic(topic: string): boolean {
	return (
		String(topic || '')
			.trim()
			.toLowerCase() === MELI_ORDERS_TOPIC
	)
}
