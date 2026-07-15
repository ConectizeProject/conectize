import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import {
	findEvolutionHubByInstance,
	resolveEvolutionApiBaseUrl,
	resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'
import {
	normalizeEvolutionEventName,
	isEvolutionMessagesDeleteEvent,
	isEvolutionMessagesUpsertEvent,
	isEvolutionSendMessageEvent,
	isEvolutionMessagesUpdateEvent,
} from '@/lib/whatsapp/normalize-evolution-event'
import {
	parseEvolutionMessageDeletes,
	parseEvolutionMessageUpserts,
} from '@/lib/whatsapp/parse-evolution-webhook-messages'
import type { EvolutionMessageUpsert } from '@/lib/whatsapp/parse-evolution-webhook-messages'
import {
	markEvolutionMessageDeleted,
	recordEvolutionOutboundMirror,
} from '@/lib/whatsapp/whatsapp-evolution-message-sync'
import { attachEvolutionMediaToStoredMessage } from '@/lib/whatsapp/whatsapp-media-storage'
import { applyWhatsappMessageDeliveryStatus } from '@/lib/whatsapp/apply-whatsapp-message-delivery-status'
import { parseEvolutionMessageStatusUpdates } from '@/lib/whatsapp/parse-evolution-message-status'
import { processWhatsappInboundTurn } from '@/lib/whatsapp/whatsapp-inbound-pipeline'

async function tryAttachEvolutionMedia (
	supabase: SupabaseClient,
	item: EvolutionMessageUpsert,
	conn: Awaited<ReturnType<typeof findEvolutionHubByInstance>>,
): Promise<void> {
	if (!item.media || !item.mediaDownloadRequest || !conn) return
	const baseUrl = resolveEvolutionApiBaseUrl(conn.metadata)
	const apiKey = resolveEvolutionApiKey(conn.access_token)
	const instanceName = String(conn.metadata.instance_name || item.instance).trim()
	if (!baseUrl || !apiKey || !instanceName) return

	try {
		await attachEvolutionMediaToStoredMessage({
			supabase,
			organizationId: conn.organization_id,
			stableWaMessageId: item.stableWaMessageId,
			baseUrl,
			apiKey,
			instanceName,
			downloadRequest: item.mediaDownloadRequest,
			media: item.media,
		})
	} catch (e) {
		console.warn('[whatsapp-evolution] media attach', item.stableWaMessageId, e)
	}
}

export async function processEvolutionWebhookPayload (
	supabase: SupabaseClient,
	payload: unknown,
): Promise<{ ingested_in: number; ingested_out: number; deleted: number }> {
	const body = payload as Record<string, unknown>
	const event = normalizeEvolutionEventName(body.event)
	const stats = { ingested_in: 0, ingested_out: 0, deleted: 0, delivery_updated: 0 }

	if (isEvolutionMessagesDeleteEvent(event)) {
		const deletes = parseEvolutionMessageDeletes(body)
		for (const d of deletes) {
			const ok = await markEvolutionMessageDeleted({ supabase, message: d })
			if (ok) stats.deleted += 1
		}
		return stats
	}

	if (
		isEvolutionMessagesUpsertEvent(event) ||
		isEvolutionSendMessageEvent(event)
	) {
		const upserts = parseEvolutionMessageUpserts(body)
		for (const m of upserts) {
			if (m.direction === 'in') {
				const conn = await findEvolutionHubByInstance(supabase, m.instance)
				await processOneEvolutionInbound(supabase, m)
				await tryAttachEvolutionMedia(supabase, m, conn)
				stats.ingested_in += 1
			} else {
				const conn = await findEvolutionHubByInstance(supabase, m.instance)
				if (!conn) continue
				await recordEvolutionOutboundMirror({
					supabase,
					organizationId: conn.organization_id,
					hubConnectionId: conn.id,
					instanceName: String(conn.metadata.instance_name || m.instance),
					message: m,
				})
				await tryAttachEvolutionMedia(supabase, m, conn)
				stats.ingested_out += 1
			}
		}
		return stats
	}

	if (isEvolutionMessagesUpdateEvent(event)) {
		const statusUpdates = parseEvolutionMessageStatusUpdates(body)
		for (const u of statusUpdates) {
			const ok = await applyWhatsappMessageDeliveryStatus({
				supabase,
				stableWaMessageId: u.stableWaMessageId,
				waMessageId: u.waMessageId,
				deliveryStatus: u.deliveryStatus,
			})
			if (ok) stats.delivery_updated += 1
		}

		const upserts = parseEvolutionMessageUpserts(body)
		for (const m of upserts) {
			if (String(m.text).toLowerCase().includes('revoked') || m.text === '[deleted]') {
				const ok = await markEvolutionMessageDeleted({
					supabase,
					message: {
						instance: m.instance,
						waMessageId: m.waMessageId,
						stableWaMessageId: m.stableWaMessageId,
						conversationKey: m.conversationKey,
					},
				})
				if (ok) stats.deleted += 1
			}
		}
	}

	return stats
}

async function processOneEvolutionInbound (
	supabase: SupabaseClient,
	item: EvolutionMessageUpsert,
): Promise<void> {
	const conn = await findEvolutionHubByInstance(supabase, item.instance)
	if (!conn) {
		console.warn('[whatsapp-evolution] no hub for instance', item.instance)
		return
	}

	const meta = conn.metadata
	const baseUrl = resolveEvolutionApiBaseUrl(meta)
	const apiKey = resolveEvolutionApiKey(conn.access_token)
	const instanceName = String(meta.instance_name || '').trim()
	const canSend = !!(apiKey && baseUrl && instanceName)

	const globalAuto = meta.automation_enabled === true

	const statePatch: Record<string, unknown> = {
		evolution_instance: instanceName,
	}
	if (item.isGroup) statePatch.is_group = true
	if (item.senderDisplayName) statePatch.display_name = item.senderDisplayName

	const outboundSend = async ({ toTarget, body }: { toTarget: string; body: string }) => {
		if (!canSend) {
			return { ok: false as const, error: 'evolution_send_not_configured' }
		}
		return sendEvolutionTextMessage({
			baseUrl: baseUrl!,
			apiKey: apiKey!,
			instanceName,
			toTarget,
			body,
		})
	}

	await processWhatsappInboundTurn({
		supabase,
		organizationId: conn.organization_id,
		hubConnectionId: conn.id,
		conversationKey: item.conversationKey,
		statePatch,
		inboundWaMessageId: item.stableWaMessageId,
		inboundText: item.text,
		automationGloballyEnabled: globalAuto,
		outboundSend,
	})
}
