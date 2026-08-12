import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'
import {
	isGlobalAutomationEnabled,
	type WhatsappHubMetadata,
} from '@/lib/whatsapp/whatsapp-hub-config'
import { processWhatsappInboundTurn } from '@/lib/whatsapp/whatsapp-inbound-pipeline'

function parseInboundMessages(payload: unknown): Array<{
	phoneNumberId: string
	from: string
	messageId: string
	text: string
}> {
	const out: Array<{
		phoneNumberId: string
		from: string
		messageId: string
		text: string
	}> = []
	const p = payload as {
		entry?: Array<{
			changes?: Array<{
				value?: {
					metadata?: { phone_number_id?: string }
					messages?: Array<{
						from?: string
						id?: string
						type?: string
						text?: { body?: string }
					}>
				}
			}>
		}>
	}
	const entries = p?.entry || []
	for (const ent of entries) {
		for (const ch of ent.changes || []) {
			const phoneNumberId = String(
				ch.value?.metadata?.phone_number_id || '',
			).trim()
			const messages = ch.value?.messages || []
			for (const m of messages) {
				if (m.type !== 'text' || !m.text?.body) continue
				const from = String(m.from || '').trim()
				const id = String(m.id || '').trim()
				if (!phoneNumberId || !from || !id) continue
				out.push({
					phoneNumberId,
					from,
					messageId: id,
					text: String(m.text.body).trim(),
				})
			}
		}
	}
	return out
}

async function findWhatsappConnectionByPhoneNumberId(
	supabase: SupabaseClient,
	phoneNumberId: string,
): Promise<{
	id: string
	access_token: string
	metadata: WhatsappHubMetadata
	organization_id: string
} | null> {
	const { data: rows } = await supabase
		.from('hub_connections')
		.select('id, access_token, metadata, organization_id')
		.eq('platform_id', 'whatsapp_business')
	const list = rows || []
	for (const r of list) {
		const meta = (r.metadata as WhatsappHubMetadata) || {}
		if (
			String(meta.phone_number_id || '') === phoneNumberId &&
			r.access_token &&
			r.organization_id
		) {
			return {
				id: String(r.id),
				access_token: r.access_token as string,
				metadata: meta,
				organization_id: String(r.organization_id),
			}
		}
	}
	return null
}

export async function processWhatsappWebhookPayload(
	supabase: SupabaseClient,
	payload: unknown,
): Promise<void> {
	const items = parseInboundMessages(payload)
	for (const item of items) {
		await processOneInboundMessage(supabase, item)
	}
}

async function processOneInboundMessage(
	supabase: SupabaseClient,
	item: {
		phoneNumberId: string
		from: string
		messageId: string
		text: string
	},
): Promise<void> {
	const conn = await findWhatsappConnectionByPhoneNumberId(
		supabase,
		item.phoneNumberId,
	)
	if (!conn) {
		console.warn(
			'[whatsapp] no hub connection for phone_number_id',
			item.phoneNumberId,
		)
		return
	}

	const globalAuto = isGlobalAutomationEnabled(conn.metadata)

	await processWhatsappInboundTurn({
		supabase,
		organizationId: conn.organization_id,
		hubConnectionId: conn.id,
		conversationKey: item.from,
		inboundWaMessageId: item.messageId,
		inboundText: item.text,
		automationGloballyEnabled: globalAuto,
		outboundSend: ({ toTarget, body }) =>
			sendWhatsAppTextMessage({
				phoneNumberId: item.phoneNumberId,
				accessToken: conn.access_token,
				toE164Digits: toTarget.replace(/\D/g, ''),
				body,
			}),
	})
}
