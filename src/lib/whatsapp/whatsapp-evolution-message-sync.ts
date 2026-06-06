import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeWaConversationKey } from '@/lib/whatsapp/wa-conversation-key'
import type { EvolutionMessageDelete, EvolutionMessageUpsert } from '@/lib/whatsapp/parse-evolution-webhook-messages'
import { upsertWhatsappConversation } from '@/lib/whatsapp/whatsapp-conversation-upsert'
import { mergePayloadDeliveryStatus } from '@/lib/whatsapp/whatsapp-message-delivery-status'

export async function recordEvolutionOutboundMirror (opts: {
	supabase: SupabaseClient
	organizationId: string
	hubConnectionId: string
	instanceName: string
	message: EvolutionMessageUpsert
}): Promise<void> {
	const { supabase, organizationId, hubConnectionId, instanceName, message } =
		opts

	const waFrom = normalizeWaConversationKey(message.conversationKey)
	if (!waFrom) return

	const lastAt = message.messageTimestamp ?? new Date().toISOString()

	const upserted = await upsertWhatsappConversation(supabase, {
		organizationId,
		hubConnectionId,
		waFrom,
		lastMessageAt: lastAt,
		needsStaffAttention: false,
		state: {
			evolution_instance: instanceName,
			is_group: message.isGroup,
		},
	})

	if (upserted.ok === false || !upserted.id) {
		console.error('[whatsapp-evolution] outbound mirror conv', upserted)
		return
	}

	const conversationId = upserted.id

	const { data: existing } = await supabase
		.from('whatsapp_messages')
		.select('id, deleted_at')
		.eq('wa_message_id', message.stableWaMessageId)
		.maybeSingle()

	if (existing?.id) {
		const basePayload = { source: 'whatsapp_device', channel: 'evolution' }
		const nextPayload = message.deliveryStatus
			? mergePayloadDeliveryStatus(basePayload, message.deliveryStatus)
			: basePayload
		if (existing.deleted_at) {
			await supabase
				.from('whatsapp_messages')
				.update({
					deleted_at: null,
					body: message.text,
					payload: nextPayload,
				})
				.eq('id', existing.id)
		} else if (message.deliveryStatus) {
			const { data: row } = await supabase
				.from('whatsapp_messages')
				.select('payload')
				.eq('id', existing.id)
				.maybeSingle()
			const merged = mergePayloadDeliveryStatus(
				(row?.payload as Record<string, unknown> | null) || nextPayload,
				message.deliveryStatus,
			)
			await supabase
				.from('whatsapp_messages')
				.update({ payload: merged })
				.eq('id', existing.id)
		}
		return
	}

	const { data: legacy } = await supabase
		.from('whatsapp_messages')
		.select('id')
		.eq('conversation_id', conversationId)
		.eq('wa_message_id', message.waMessageId)
		.maybeSingle()

	if (legacy?.id) {
		await supabase
			.from('whatsapp_messages')
			.update({ wa_message_id: message.stableWaMessageId })
			.eq('id', legacy.id)
		return
	}

	const insertPayload = message.deliveryStatus
		? mergePayloadDeliveryStatus(
			{ source: 'whatsapp_device', channel: 'evolution' },
			message.deliveryStatus,
		)
		: { source: 'whatsapp_device', channel: 'evolution', delivery_status: 'sent' }

	await supabase.from('whatsapp_messages').insert({
		conversation_id: conversationId,
		direction: 'out',
		wa_message_id: message.stableWaMessageId,
		body: message.text,
		payload: insertPayload,
		status: 'attended',
		resolved_by: 'human',
		needs_human: false,
	})
}

export async function markEvolutionMessageDeleted (opts: {
	supabase: SupabaseClient
	message: EvolutionMessageDelete
}): Promise<boolean> {
	const { supabase, message } = opts
	const now = new Date().toISOString()

	const tryIds = [message.stableWaMessageId, message.waMessageId]

	for (const waMessageId of tryIds) {
		const { data: row } = await supabase
			.from('whatsapp_messages')
			.select('id, deleted_at')
			.eq('wa_message_id', waMessageId)
			.maybeSingle()

		if (!row?.id) continue

		if (row.deleted_at) return true

		await supabase
			.from('whatsapp_messages')
			.update({ deleted_at: now })
			.eq('id', row.id)

		return true
	}

	return false
}
